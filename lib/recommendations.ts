import "server-only";
import { curatedApartmentData } from "./curated-apartment-data";
import { findCuratedApartment } from "./curated-apartments";
import { nearUT } from "./discovery";
import { readProfile } from "./apartments";
import { prisma } from "./db";
import { buildProfile, type ApartmentProfile, type ProfileStatusHandler } from "./profile";
import { searchWestCampusMaps } from "./serpapi";
import { matchingPlans, recurringFees, type RecommendationCriteria } from "./recommendation-criteria";
import { snowflakeConfigured, snowflakeQuery } from "./snowflake";

export async function recommendApartments(criteria: RecommendationCriteria, status: ProfileStatusHandler) {
  let candidates = curatedApartmentData.flatMap((property) => {
    const plans = matchingPlans(property, criteria);
    return plans.length ? [{ property, plans }] : [];
  });
  let provider = "curated";
  let fallbackReason: string | null = snowflakeConfigured() ? null : "snowflake_not_configured";
  const profiles = new Map<string, ApartmentProfile>();
  if (snowflakeConfigured()) {
    try {
      // Each row is one floorplan: bedroom and price predicates cannot match different layouts.
      const rows = await snowflakeQuery(`SELECT PROPERTY_ID, PLAN_ID FROM UNLISTED_FLOORPLANS
        WHERE (? = -1 OR BEDS = ?) AND (? = -1 OR BATHS >= ?)
        AND (? = -1 OR (RENT_BASIS = ? AND BASE_RENT IS NOT NULL AND
          ((? = 'under' AND BASE_RENT < ?) OR (? = 'at_most' AND BASE_RENT <= ?))))`, [
        { type: "FIXED", value: String(criteria.beds ?? -1) }, { type: "FIXED", value: String(criteria.beds ?? -1) },
        { type: "FIXED", value: String(criteria.baths ?? -1) }, { type: "FIXED", value: String(criteria.baths ?? -1) },
        { type: "FIXED", value: String(criteria.maxRent ?? -1) }, { type: "TEXT", value: criteria.priceBasis },
        { type: "TEXT", value: criteria.comparison }, { type: "FIXED", value: String(criteria.maxRent ?? -1) },
        { type: "TEXT", value: criteria.comparison }, { type: "FIXED", value: String(criteria.maxRent ?? -1) },
      ]);
      candidates = candidates.flatMap((candidate) => {
        const ids = new Set(rows.filter((row) => row[0] === candidate.property.id).map((row) => row[1]));
        const plans = candidate.plans.filter((plan) => ids.has(plan.id));
        return plans.length ? [{ ...candidate, plans }] : [];
      });
      provider = "snowflake";
    } catch { fallbackReason = "snowflake_unavailable"; }
    if (provider === "snowflake") {
      try {
        const rows = await snowflakeQuery("SELECT PROFILE FROM UNLISTED_RESEARCH WHERE FETCHED_AT > DATEADD(hour, -24, CURRENT_TIMESTAMP())");
        for (const row of rows) {
          try {
            const profile = readProfile(typeof row[0] === "string" ? JSON.parse(row[0]) : row[0]);
            if (profile?.curated) profiles.set(profile.curated.id, { ...profile, labels: [] });
          } catch { /* A malformed public cache row is never ranking evidence. */ }
        }
      } catch { /* Catalog still works; refresh missing public review evidence below. */ }
    }
  }
  try {
    const rows = await prisma.$queryRaw<{ profile: unknown }[]>`SELECT "profile" FROM "ApartmentResearch" WHERE "expiresAt" > NOW() LIMIT 500`;
    for (const row of rows) {
      const profile = readProfile(row.profile);
      if (profile?.curated && !profiles.has(profile.curated.id)) profiles.set(profile.curated.id, { ...profile, labels: [] });
    }
    if (provider !== "snowflake") provider = "postgres_curated";
  } catch { /* Curated price filtering remains available without Postgres research. */ }
  const score = (profile?: ApartmentProfile): number | null => {
    if (!profile) return null;
    const value = criteria.rankBy === "google_rating" ? profile.googleRating : profile.honestRating;
    const count = criteria.rankBy === "google_rating" ? profile.googleReviewCount ?? 0 : profile.honestCount;
    return value !== null && count >= criteria.minReviewCount && (criteria.minRating === null || value >= criteria.minRating) ? value : null;
  };
  candidates.sort((a, b) => (score(profiles.get(b.property.id)) ?? -1) - (score(profiles.get(a.property.id)) ?? -1) || (a.plans[0].baseRent ?? Infinity) - (b.plans[0].baseRent ?? Infinity));
  const pool = candidates.slice(0, 8);
  let failedResearch = 0;
  for (const { property } of pool) {
    if (profiles.has(property.id)) continue;
    try {
      status("place");
      const locals = await searchWestCampusMaps(`${property.name} ${property.address ?? ""} Austin apartment`);
      const place = Array.isArray(locals) ? locals.find((row) => row && typeof row === "object" && nearUT(row) && findCuratedApartment(typeof row.title === "string" ? row.title : "", typeof row.address === "string" ? row.address : null)?.id === property.id && typeof row.place_id === "string") : null;
      if (!place) { failedResearch++; continue; }
      // Two calls per candidate: a verified place lookup and one reviews page, plus discovery.
      const profile = await buildProfile(String(place.place_id), status, true);
      if (profile.curated?.id !== property.id) { failedResearch++; continue; }
      profiles.set(property.id, profile);
      try {
        const fetchedAt = new Date(profile.fetchedAt);
        const expiresAt = new Date(fetchedAt.getTime() + 86400000);
        await prisma.$executeRaw`INSERT INTO "ApartmentResearch" ("placeId", "profile", "fetchedAt", "expiresAt") VALUES (${profile.placeId}, ${JSON.stringify({ ...profile, labels: [] })}::jsonb, ${fetchedAt}, ${expiresAt}) ON CONFLICT ("placeId") DO UPDATE SET "profile" = EXCLUDED."profile", "fetchedAt" = EXCLUDED."fetchedAt", "expiresAt" = EXCLUDED."expiresAt"`;
      } catch { /* A cache failure must not discard successful research. */ }
    } catch { failedResearch++; }
  }
  const ranked = pool.flatMap((candidate) => {
    const profile = profiles.get(candidate.property.id);
    if (criteria.rankBy === "lowest_price" && (candidate.plans[0].baseRent === null || candidate.plans[0].rentBasis !== criteria.priceBasis)) return [];
    if (!profile || (criteria.rankBy !== "lowest_price" && score(profile) === null)) return [];
    if (criteria.rankBy === "lowest_price" && criteria.minRating !== null && score(profile) === null) return [];
    return [{ ...candidate, profile, score: score(profile), price: candidate.plans[0].baseRent }];
  });
  ranked.sort((a, b) => criteria.rankBy === "lowest_price"
    ? (a.price ?? Infinity) - (b.price ?? Infinity)
    : (b.score ?? -1) - (a.score ?? -1) || b.profile.honestCount - a.profile.honestCount || (a.price ?? Infinity) - (b.price ?? Infinity));
  const matches = ranked.slice(0, 3).map(({ property, plans, profile, score }) => ({
    profile: { ...profile, floorplans: profile.floorplans.filter((plan) => plan.curated && plans.some((match) => match.id === plan.curated?.id)) },
    matchedPlans: plans, rating: score, knownRequiredRecurringFees: recurringFees(property.fees),
  }));
  return { provider, fallbackReason, criteria, catalogMatches: candidates.length, candidatesChecked: pool.length, failedResearch,
    scope: "Best matches among checked curated properties, not all apartments in Austin. Dated source prices; optional upgrades, one-time fees and usage utilities are separate. No qualifying review evidence means no rating-based recommendation.",
    matches };
}
