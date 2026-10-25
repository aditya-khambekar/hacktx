import "server-only";

import { readSnowflakeResearch, writeSnowflakeResearch } from "./snowflake-research";
import { PRICING_VERSION } from "./listing-types";
import { prisma } from "./db";
import { readProfile } from "./apartments";
import { buildDiscoveredProfile } from "./discovery";
import type { ApartmentProfile } from "./profile";

export const RESEARCH_TTL_MS = 24 * 60 * 60 * 1000;
const pending = new Map<string, Promise<ApartmentProfile>>();

/** Reuse verified public research, never another user's labels or shortlist. */
export async function researchApartment(placeId: string, force = false): Promise<ApartmentProfile> {
  if (!force) {
    const shared = await readSnowflakeResearch(placeId);
    if (shared) return shared;
    const rows = await prisma.$queryRaw<{ profile: unknown }[]>`
      SELECT "profile" FROM "ApartmentResearch"
      WHERE "placeId" = ${placeId} AND "expiresAt" > NOW() LIMIT 1
    `.catch(() => [] as { profile: unknown }[]);
    const cached = rows[0] ? readProfile(rows[0].profile) : null;
    if (cached && cached.pricingVersion === PRICING_VERSION && Array.isArray(cached.amenities) && Array.isArray(cached.propertyFees) && cached.placeId === placeId) {
      const profile = { ...cached, labels: [] };
      await writeSnowflakeResearch(profile);
      return profile;
    }
  }
  const active = pending.get(placeId);
  if (active) return active;
  const job = (async () => {
    const profile = { ...await buildDiscoveredProfile(placeId, force), labels: [] };
    // Only a complete, successful build replaces an older entry.
    const fetchedAt = new Date(profile.fetchedAt);
    const expiresAt = new Date(fetchedAt.getTime() + RESEARCH_TTL_MS);
    await prisma.$executeRaw`
      INSERT INTO "ApartmentResearch" ("placeId", "profile", "fetchedAt", "expiresAt")
      VALUES (${placeId}, ${JSON.stringify(profile)}::jsonb, ${fetchedAt}, ${expiresAt})
      ON CONFLICT ("placeId") DO UPDATE SET "profile" = EXCLUDED."profile",
      "fetchedAt" = EXCLUDED."fetchedAt", "expiresAt" = EXCLUDED."expiresAt"
    `.catch(() => {
      console.warn("[research-cache]", { provider: "postgres", operation: "write_failed" });
    });
    return profile;
  })().finally(() => pending.delete(placeId));
  pending.set(placeId, job);
  return job;
}
