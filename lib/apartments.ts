import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { ApartmentProfile } from "./profile";
import { honestRating } from "./rating";

export const apartmentFields = {
  id: true,
  placeId: true,
  name: true,
  address: true,
  labels: true,
  honestRating: true,
  honestCount: true,
  excludedTour: true,
  profile: true,
} as const satisfies Prisma.ApartmentSelect;

type Check = (value: unknown) => boolean;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const string: Check = (value) => typeof value === "string";
const nonempty: Check = (value) => typeof value === "string" && !!value.trim();
const number: Check = (value) => typeof value === "number" && Number.isFinite(value);
const nonnegative: Check = (value) => number(value) && (value as number) >= 0;
const count: Check = (value) => nonnegative(value) && Number.isInteger(value);
const rating: Check = (value) => nonnegative(value) && (value as number) <= 5;
const nullable = (check: Check): Check => (value) => value === null || check(value);
const array = (check: Check): Check => (value) => Array.isArray(value) && value.every(check);
const object = (fields: Record<string, Check>): Check => (value) =>
  isRecord(value) &&
  Object.keys(value).length === Object.keys(fields).length &&
  Object.entries(fields).every(([key, check]) => check(value[key]));

const route = object({
  distanceMeters: nonnegative,
  durationSeconds: nonnegative,
  formattedDistance: string,
  formattedDuration: string,
});

const profileShape = object({
  placeId: nonempty,
  name: nonempty,
  address: nullable(string),
  mapsUrl: nonempty,
  website: nullable(string),
  phone: nullable(string),
  labels: array(string),
  fetchedAt: (value) => typeof value === "string" && Number.isFinite(Date.parse(value)),
  googleRating: nullable(rating),
  googleReviewCount: nullable(count),
  honestRating: nullable(rating),
  honestCount: count,
  excludedTour: count,
  unclearCount: count,
  campus: object({
    destination: (value) => value === "UT Tower",
    endCoords: (value) => value === "30.2862,-97.7394",
    walking: nullable(route),
    cycling: nullable(route),
  }),
  floorplans: array(object({
    name: nullable(string),
    beds: nullable(nonnegative),
    baths: nullable(nonnegative),
    sqft: nullable(nonnegative),
    baseRent: nullable(nonnegative),
    sourceUrl: nonempty,
    fees: array(object({
      name: string,
      amount: nullable(nonnegative),
      cadence: nullable(string),
    })),
  })),
  reviews: array(object({
    id: string,
    rating,
    text: string,
    date: nullable(string),
    author: nullable(string),
    link: nullable(string),
    about: (value) => value === "tour" || value === "apartment" || value === "unclear",
    reason: string,
  })),
  sources: array(string),
});

export function normalizeLabels(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((label) => typeof label === "string")) {
    return null;
  }
  const labels = value.map((label: string) => label.trim().toLowerCase());
  if (labels.some((label) => !label || label.length > 32)) return null;
  return [...new Set(labels)];
}

export function readProfile(value: unknown): ApartmentProfile | null {
  if (!isRecord(value)) return null;
  const { amenities, propertyFees, pricingVersion, curated: _curated, ...base } = value;
  void _curated;
  if (pricingVersion !== undefined && pricingVersion !== 1) return null;
  const originalFee = (fee: unknown) => {
    if (!isRecord(fee)) return null;
    const { sourceUrl, applies, conditions, ...original } = fee;
    if (sourceUrl !== undefined && !nonempty(sourceUrl) ||
        applies !== undefined && (typeof applies !== "string" || !["required", "optional", "conditional"].includes(applies)) ||
        conditions !== undefined && !nullable(string)(conditions)) return null;
    return original;
  };
  if (amenities !== undefined && !array(object({ name: nonempty, sourceUrl: nonempty }))(amenities)) return null;
  if (propertyFees !== undefined && (!Array.isArray(propertyFees) || !propertyFees.every((fee) => {
    const original = originalFee(fee);
    return isRecord(fee) && nonempty(fee.sourceUrl) && object({ name: nonempty, amount: nullable(nonnegative), cadence: nullable(string) })(original);
  }))) return null;
  const plans = Array.isArray(base.floorplans) ? base.floorplans.map((plan) => {
    if (!isRecord(plan)) return plan;
    const { rentBasis, publishedMonthlyTotal, priceKind, leaseTerm, sourceKind, curated: _planCurated, ...original } = plan;
    void _planCurated;
    if (publishedMonthlyTotal !== undefined && !nullable(nonnegative)(publishedMonthlyTotal) ||
        publishedMonthlyTotal !== undefined && publishedMonthlyTotal !== null && typeof plan.baseRent === "number" && Number(publishedMonthlyTotal) < plan.baseRent ||
        priceKind !== undefined && priceKind !== null && (typeof priceKind !== "string" || !["starting at", "exact", "range"].includes(priceKind)) ||
        leaseTerm !== undefined && !nullable(string)(leaseTerm) ||
        sourceKind !== undefined && sourceKind !== "official page" && sourceKind !== "search snippet") return null;
    if (rentBasis !== undefined && rentBasis !== null && rentBasis !== "per person" && rentBasis !== "per unit") return null;
    return { ...original, fees: Array.isArray(original.fees) ? original.fees.map(originalFee) : original.fees };
  }) : base.floorplans;
  if (!profileShape({ ...base, floorplans: plans })) return null;
  const profile = value as ApartmentProfile;
  const labels = normalizeLabels(profile.labels);
  if (!labels) return null;

  // A valid profile's score and counts must agree with its retained reviews.
  const summary = honestRating(profile.reviews);
  if (
    profile.honestCount !== summary.honestCount ||
    profile.excludedTour !== summary.excludedTour ||
    profile.unclearCount !== summary.unclearCount ||
    (summary.honestRating === null
      ? profile.honestRating !== null
      : profile.honestRating === null ||
        Math.abs(profile.honestRating - summary.honestRating) > 1e-9)
  ) return null;

  // Invalidate old bundled overlays instead of showing them as researched prices.
  const hadCurated = value.curated !== undefined || profile.floorplans.some(plan => plan.curated !== undefined || plan.sourceUrl?.startsWith("curated:"));
  const clean: ApartmentProfile = { ...profile, labels,
    floorplans: profile.floorplans.filter(plan => !plan.curated && !plan.sourceUrl?.startsWith("curated:")).map(({ curated: _metadata, ...plan }) => { void _metadata; return plan; }),
    sources: profile.sources.filter(source => !source.startsWith("curated:")),
  };
  delete clean.curated;
  if (hadCurated) {
    clean.amenities = [];
    clean.propertyFees = [];
    delete clean.pricingVersion; // Next research request must fetch real sources again.
  }
  return clean;
}

export function profileData(profile: ApartmentProfile) {
  return {
    name: profile.name,
    address: profile.address,
    labels: profile.labels,
    profile,
    honestRating: profile.honestRating,
    honestCount: profile.honestCount,
    excludedTour: profile.excludedTour,
  };
}

export function apartmentJson(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export function apartmentServerError(error: unknown, operation: string) {
  const code = isRecord(error) && typeof error.code === "string" && /^P\d{4}$/.test(error.code)
    ? error.code : undefined;
  const message = error instanceof Error ? error.message : "";
  const diagnostic = code === "P2021" || code === "P2022"
    ? "database_schema_outdated"
    : /TLS|SSL|certificate/i.test(message)
      ? "database_tls_error"
      : error instanceof TypeError && /undefined/.test(message) && /findMany|findFirst|findUnique|upsert|update|deleteMany|\$transaction/.test(message)
        ? "prisma_client_outdated"
        : "database_request_failed";
  // Do not log raw errors: Prisma messages can contain connection details or input.
  console.error("[apartments]", { operation, diagnostic, code });
  return apartmentJson({
    error: "internal_error",
    ...(process.env.NODE_ENV === "development" ? { diagnostic } : {}),
  }, 500);
}

/** Retry conflicts so concurrent saves and label edits do not erase each other. */
export async function apartmentTransaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: "Serializable" });
    } catch (error) {
      if (attempt >= 2 || !isRecord(error) || error.code !== "P2034") throw error;
    }
  }
}
