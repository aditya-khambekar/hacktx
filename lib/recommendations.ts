import "server-only";
import { readProfile } from "./apartments";
import { prisma } from "./db";
import { buildDiscoveredProfile, nearUT } from "./discovery";
import type { ApartmentProfile, ProfileStatusHandler } from "./profile";
import { PRICING_VERSION } from "./listing-types";
import { searchWestCampusMaps } from "./serpapi";
import { matchingPlans, researchedCost, type RecommendationCriteria } from "./recommendation-criteria";
import { snowflakeConfigured, snowflakeQuery } from "./snowflake";

export async function recommendApartments(criteria: RecommendationCriteria, status: ProfileStatusHandler) {
  const profiles = new Map<string, ApartmentProfile>();
  const providers = new Map<string,string>();
  let fallbackReason: string | null = snowflakeConfigured() ? null : "snowflake_not_configured";
  const keep = (input: unknown, provider: string) => {
    try {
      const profile = readProfile(typeof input === "string" ? JSON.parse(input) : input);
      if (!profile || profile.pricingVersion !== PRICING_VERSION || Date.now()-Date.parse(profile.fetchedAt) >= 86400000 || Date.parse(profile.fetchedAt) > Date.now()+60000) return;
      const previous = profiles.get(profile.placeId);
      if (!previous || Date.parse(previous.fetchedAt) < Date.parse(profile.fetchedAt)) {
        profiles.set(profile.placeId,{...profile,labels:[]});providers.set(profile.placeId,provider);
      }
    } catch { /* Invalid/old demo rows are never recommendation evidence. */ }
  };
  if (snowflakeConfigured()) {
    try {
      // Predicates apply to a single researched floorplan; all-in costs are rechecked below.
      const rows = await snowflakeQuery(`SELECT DISTINCT r.PROFILE FROM UNLISTED_RESEARCH r,
        LATERAL FLATTEN(INPUT => r.PROFILE:floorplans) plan
        WHERE r.FETCHED_AT > DATEADD(hour, -24, CURRENT_TIMESTAMP())
          AND (? = -1 OR plan.value:beds::NUMBER = ?)
          AND (? = -1 OR plan.value:baths::FLOAT >= ?)
          AND (? = -1 OR (plan.value:rentBasis::VARCHAR = ? AND plan.value:baseRent IS NOT NULL AND
            ((? = 'under' AND plan.value:baseRent::FLOAT < ?) OR (? = 'at_most' AND plan.value:baseRent::FLOAT <= ?)))) LIMIT 500`, [
        {type:"FIXED",value:String(criteria.beds ?? -1)},{type:"FIXED",value:String(criteria.beds ?? -1)},
        {type:"FIXED",value:String(criteria.baths ?? -1)},{type:"FIXED",value:String(criteria.baths ?? -1)},
        {type:"FIXED",value:String(criteria.maxRent ?? -1)},{type:"TEXT",value:criteria.priceBasis},
        {type:"TEXT",value:criteria.comparison},{type:"FIXED",value:String(criteria.maxRent ?? -1)},
        {type:"TEXT",value:criteria.comparison},{type:"FIXED",value:String(criteria.maxRent ?? -1)},
      ]);
      for (const row of rows) keep(row[0],"snowflake");
    } catch { fallbackReason = "snowflake_unavailable"; }
  }
  try {
    const rows = await prisma.$queryRaw<{profile:unknown}[]>`SELECT "profile" FROM "ApartmentResearch" WHERE "expiresAt" > NOW() LIMIT 500`;
    for (const row of rows) keep(row.profile,"postgres");
  } catch { /* Live research remains usable when the optional public cache is unavailable. */ }
  const score = (profile: ApartmentProfile) => {
    const google = criteria.rankBy === "google_rating";
    const value = google ? profile.googleRating : profile.honestRating;
    const count = google ? profile.googleReviewCount ?? 0 : profile.honestCount;
    return value !== null && count >= criteria.minReviewCount && (criteria.minRating === null || value >= criteria.minRating) ? value : null;
  };
  const eligible = () => [...profiles.values()].flatMap(profile => {
    const plans = matchingPlans(profile,criteria);
    return plans.length ? [{profile,plans}] : [];
  });
  let candidates = eligible();
  let failedResearch = 0, liveChecked = 0;
  if (!candidates.length) {
    // Two full research builds plus discovery fit the existing 24-call per-turn budget.
    try {
      status("place");
      const results = await searchWestCampusMaps("apartments near UT Austin West Campus");
      const ids = Array.isArray(results) ? [...new Set(results.filter(row => row && typeof row === "object" && nearUT(row) && typeof row.place_id === "string").map(row=>String(row.place_id)))].filter(id=>!profiles.has(id)).slice(0,2) : [];
      for (const id of ids) {
        liveChecked++;
        try {
          const profile = await buildDiscoveredProfile(id);
          keep(profile,"live");
          try {
            const fetchedAt = new Date(profile.fetchedAt), expiresAt = new Date(fetchedAt.getTime()+86400000);
            await prisma.$executeRaw`INSERT INTO "ApartmentResearch" ("placeId", "profile", "fetchedAt", "expiresAt") VALUES (${profile.placeId}, ${JSON.stringify({...profile,labels:[]})}::jsonb, ${fetchedAt}, ${expiresAt}) ON CONFLICT ("placeId") DO UPDATE SET "profile" = EXCLUDED."profile", "fetchedAt" = EXCLUDED."fetchedAt", "expiresAt" = EXCLUDED."expiresAt"`;
          } catch { /* Snowflake already persists successful full builds independently. */ }
        } catch { failedResearch++; }
      }
    } catch { failedResearch++; }
    candidates = eligible();
  }
  const price = (candidate: typeof candidates[number]) => criteria.priceScope === "required_recurring" ? researchedCost(candidate.profile,candidate.plans[0]).total : candidate.plans[0].baseRent;
  candidates.sort((a,b) => criteria.rankBy === "lowest_price" ? (price(a) ?? Infinity)-(price(b) ?? Infinity) : (score(b.profile) ?? -1)-(score(a.profile) ?? -1) || (price(a) ?? Infinity)-(price(b) ?? Infinity));
  const pool = candidates.slice(0,8);
  const ranked = pool.filter(({profile}) => criteria.rankBy === "lowest_price" && criteria.minRating === null || score(profile) !== null);
  const matches = ranked.slice(0,3).map(({profile,plans}) => {
    const costs = researchedCost(profile,plans[0]);
    return {profile:{...profile,floorplans:plans},matchedPlans:plans,rating:score(profile),
      knownRequiredRecurringFees:{amount:costs.total !== null && plans[0].baseRent !== null ? Math.round((costs.total-plans[0].baseRent)*100)/100 : null,unknownCount:costs.unknownCount}};
  });
  const used = [...new Set((matches.length ? matches.map(m=>m.profile) : pool.map(c=>c.profile)).map(p=>providers.get(p.placeId)).filter(Boolean))];
  return {provider:used.join("+") || "none",fallbackReason,criteria,catalogMatches:candidates.length,candidatesChecked:Math.max(pool.length,liveChecked),failedResearch,
    scope:"Matches among cached researched properties and the limited live candidates checked, not all apartments in Austin. Published starting prices are not availability guarantees. Optional, one-time and usage fees are separate.",matches};
}
