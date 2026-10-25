import type { ApartmentProfile } from "./profile";
import type { ListingFloorplan } from "./listing-types";

export const AMENITY_NAMES = ["pets", "pool", "parking", "gym", "laundry", "furnished"] as const;
export type AmenityName = typeof AMENITY_NAMES[number];
export type RecommendationCriteria = {
  maxRent: number | null; beds: number | null; baths: number | null;
  amenities: AmenityName[]; rankBy: "resident_rating" | "google_rating" | "lowest_price";
  priceScope: "base_rent" | "required_recurring"; priceBasis: "per person" | "per unit";
  comparison: "under" | "at_most"; roomType: "any" | "private" | "shared";
  allowSmart: boolean; minRating: number | null; minReviewCount: number;
};
const keys = ["maxRent", "beds", "baths", "amenities", "rankBy", "priceScope", "priceBasis", "comparison", "roomType", "allowSmart", "minRating", "minReviewCount"];
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
export function readRecommendationCriteria(value: unknown): RecommendationCriteria | null {
  if (!record(value) || Object.keys(value).some((key) => !keys.includes(key))) return null;
  const optional = (key: string, max: number, integer = false) => value[key] === undefined || (typeof value[key] === "number" && Number.isFinite(value[key]) && value[key] >= 0 && value[key] <= max && (!integer || Number.isInteger(value[key])));
  if (!optional("maxRent", 100000) || value.maxRent === 0 || !optional("beds", 20, true) || !optional("baths", 20) || !optional("minRating", 5) || !optional("minReviewCount", 10000, true)) return null;
  if (value.amenities !== undefined && (!Array.isArray(value.amenities) || value.amenities.some((v) => !AMENITY_NAMES.includes(v)))) return null;
  for (const [key, choices] of Object.entries({ rankBy: ["resident_rating", "google_rating", "lowest_price"], priceScope: ["base_rent", "required_recurring"], priceBasis: ["per person", "per unit"], comparison: ["under", "at_most"], roomType: ["any", "private", "shared"] })) {
    if (value[key] !== undefined && !choices.includes(value[key] as string)) return null;
  }
  if (value.allowSmart !== undefined && typeof value.allowSmart !== "boolean") return null;
  return {
    maxRent: value.maxRent as number ?? null, beds: value.beds as number ?? null, baths: value.baths as number ?? null,
    amenities: [...new Set(value.amenities as AmenityName[] ?? [])], rankBy: value.rankBy as RecommendationCriteria["rankBy"] ?? "resident_rating",
    priceScope: value.priceScope as RecommendationCriteria["priceScope"] ?? "base_rent", priceBasis: value.priceBasis as RecommendationCriteria["priceBasis"] ?? "per person",
    comparison: value.comparison as RecommendationCriteria["comparison"] ?? "under", roomType: value.roomType as RecommendationCriteria["roomType"] ?? "any",
    allowSmart: value.allowSmart as boolean ?? false, minRating: value.minRating as number ?? null, minReviewCount: value.minReviewCount as number ?? 1,
  };
}

const patterns: Record<AmenityName, RegExp> = {
  pets: /pet[- ]friendly|pets? allowed|dog[- ]friendly|cat[- ]friendly/i,
  pool: /\bpool\b/i, parking: /parking|garage/i, gym: /\bgym\b|fitness/i,
  laundry: /in[- ]unit (laundry|washer)|washer.*dryer/i, furnished: /\bfurnished\b/i,
};
export function amenityCodes(names: string[]): AmenityName[] {
  return AMENITY_NAMES.filter((code) => names.some((name) => !/\b(no|not|without|unfurnished)\b/i.test(name) && patterns[code].test(name)));
}
/** Published inclusive totals already include mandatory monthly fees. */
export function researchedCost(profile: ApartmentProfile, plan: ListingFloorplan) {
  if (plan.publishedMonthlyTotal != null) return { total: plan.publishedMonthlyTotal, unknownCount: 0 };
  const fees = [...new Map([...plan.fees,...(profile.propertyFees ?? [])].map(f => [JSON.stringify([f.name.toLowerCase(),f.cadence,f.amount]),f])).values()];
  let extra = 0, unknownCount = fees.length ? 0 : 1;
  for (const fee of fees) {
    if (fee.applies === "optional" || /one.?time|annual|application|move.?in/i.test(fee.cadence ?? "")) continue;
    if (fee.applies !== "required" || !/month|installment/i.test(fee.cadence ?? "") || fee.amount === null) unknownCount++;
    else extra += fee.amount;
  }
  return { total:plan.baseRent === null ? null : Math.round((plan.baseRent+extra)*100)/100, unknownCount };
}
export function matchingPlans(profile: ApartmentProfile, criteria: RecommendationCriteria): ListingFloorplan[] {
  const codes = amenityCodes((profile.amenities ?? []).map(a => a.name));
  if (criteria.amenities.some(code => !codes.includes(code))) return [];
  const cost = (plan: ListingFloorplan) => criteria.priceScope === "base_rent" ? plan.baseRent : researchedCost(profile,plan).total;
  return profile.floorplans.filter(plan => {
    if (criteria.beds !== null && plan.beds !== criteria.beds) return false;
    if (criteria.baths !== null && (plan.baths === null || plan.baths < criteria.baths)) return false;
    if (!criteria.allowSmart && /s\W*m\W*a\W*r\W*t/i.test(plan.name ?? "")) return false;
    const room = /shared bedroom/i.test(plan.name ?? "") ? "shared" : /private/i.test(plan.name ?? "") ? "private" : "unknown";
    if (criteria.roomType !== "any" && criteria.roomType !== room) return false;
    if (criteria.maxRent === null && criteria.rankBy !== "lowest_price") return true;
    if (plan.baseRent === null || plan.rentBasis !== criteria.priceBasis) return false;
    if (criteria.priceScope === "required_recurring" && researchedCost(profile,plan).unknownCount) return false;
    const amount = cost(plan);
    return amount !== null && (criteria.maxRent === null || (criteria.comparison === "under" ? amount < criteria.maxRent : amount <= criteria.maxRent));
  }).sort((a,b) => (cost(a) ?? Infinity) - (cost(b) ?? Infinity));
}
