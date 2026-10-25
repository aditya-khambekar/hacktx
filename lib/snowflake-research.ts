import "server-only";
import { readProfile } from "./apartments";
import { PRICING_VERSION } from "./listing-types";
import { snowflakeConfigured, snowflakeQuery } from "./snowflake";
import type { ApartmentProfile } from "./profile";

const RESEARCH_TTL_MS = 24 * 60 * 60 * 1000;
const local = new Map<string, { at: number; job: Promise<ApartmentProfile | null> }>();

/** Only public research goes here. Never pass saved boards or conversation records. */
function publicProfile(value: ApartmentProfile): ApartmentProfile | null {
  const profile = readProfile({ ...value, labels: [] });
  if (!profile || profile.pricingVersion !== PRICING_VERSION ||
      !Array.isArray(profile.amenities) || !Array.isArray(profile.propertyFees)) return null;
  const age = Date.now() - Date.parse(profile.fetchedAt);
  return age >= -60_000 && age < RESEARCH_TTL_MS ? { ...profile, labels: [] } : null;
}

/** A small process cache coalesces simultaneous reads; Snowflake persists across restarts/users. */
export function readSnowflakeResearch(placeId: string): Promise<ApartmentProfile | null> {
  if (!snowflakeConfigured()) return Promise.resolve(null);
  const existing = local.get(placeId);
  if (existing && Date.now() - existing.at < 60_000) return existing.job.then(profile => profile ? publicProfile(profile) : null);
  const job = snowflakeQuery(`SELECT PROFILE FROM UNLISTED_RESEARCH
    WHERE PROPERTY_ID = ? AND FETCHED_AT > DATEADD(hour, -24, CURRENT_TIMESTAMP())
    ORDER BY FETCHED_AT DESC LIMIT 1`, [{ type: "TEXT", value: placeId }])
    .then(rows => {
      let value = rows[0]?.[0];
      if (typeof value === "string") { try { value = JSON.parse(value); } catch { return null; } }
      const validated = readProfile(value);
      const profile = validated ? publicProfile(validated) : null;
      return profile?.placeId === placeId ? profile : null;
    })
    .catch(() => null); // Missing configuration/table/outage leaves the existing research flow usable.
  if (local.size >= 300) local.delete(local.keys().next().value!);
  local.set(placeId, { at: Date.now(), job });
  return job;
}

/** Successful full research replaces older public data. A failed refresh never calls this. */
export async function writeSnowflakeResearch(value: ApartmentProfile): Promise<boolean> {
  if (!snowflakeConfigured()) return false;
  const profile = publicProfile(value);
  if (!profile) return false;
  try {
    await snowflakeQuery(`MERGE INTO UNLISTED_RESEARCH target USING
      (SELECT ? AS PROPERTY_ID, PARSE_JSON(?) AS PROFILE, TO_TIMESTAMP_LTZ(TO_NUMBER(?), 3) AS FETCHED_AT) incoming
      ON target.PROPERTY_ID = incoming.PROPERTY_ID
      WHEN MATCHED AND (target.FETCHED_AT IS NULL OR incoming.FETCHED_AT >= target.FETCHED_AT)
        THEN UPDATE SET PROFILE = incoming.PROFILE, FETCHED_AT = incoming.FETCHED_AT
      WHEN NOT MATCHED THEN INSERT (PROPERTY_ID, PROFILE, FETCHED_AT)
        VALUES (incoming.PROPERTY_ID, incoming.PROFILE, incoming.FETCHED_AT)`, [
      { type: "TEXT", value: profile.placeId },
      { type: "TEXT", value: JSON.stringify(profile) },
      { type: "FIXED", value: String(Date.parse(profile.fetchedAt)) },
    ]);
    if (local.size >= 300) local.delete(local.keys().next().value!);
    local.set(profile.placeId, { at: Date.now(), job: Promise.resolve(profile) });
    return true;
  } catch {
    console.warn("[research-cache]", { provider: "snowflake", operation: "write_failed" });
    return false;
  }
}

/** Hydrate this user's board from public research without sharing their labels. */
export async function withSnowflakeResearch(profile: ApartmentProfile): Promise<ApartmentProfile> {
  const cached = await readSnowflakeResearch(profile.placeId);
  if (!cached || profile.pricingVersion === PRICING_VERSION && Date.parse(cached.fetchedAt) < Date.parse(profile.fetchedAt)) return profile;
  return { ...cached, labels: profile.labels, campus: { ...cached.campus,
    walking: cached.campus.walking ?? profile.campus.walking,
    cycling: cached.campus.cycling ?? profile.campus.cycling,
  } };
}
