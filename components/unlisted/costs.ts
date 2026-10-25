import type { ApartmentProfile, ComparisonApartment, Fee, FeeCadence } from "./types";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const usdCents = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatUsd(amount: number) {
  return (Number.isInteger(amount) ? usd : usdCents).format(amount);
}

export type CostSummary = {
  rent: number | null;
  monthlyFees: Fee[];
  oneTimeFees: Fee[];
  /** Rent plus every monthly fee with a number. */
  monthlyTotal: number | null;
  monthlyHasEstimate: boolean;
  monthlyUnknownCount: number;
  oneTimeTotal: number;
  oneTimeUnknownCount: number;
  refundableTotal: number;
  unclassifiedFees: Fee[];
  conditionalFees: Fee[];
  usesPublishedTotal: boolean;
};

export function summarizeCosts(apartment: ComparisonApartment): CostSummary {
  const included = apartment.fees.filter((fee) => fee.applies !== "optional" && fee.applies !== "conditional");
  const monthlyFees = included.filter((fee) => fee.cadence === "monthly");
  const oneTimeFees = included.filter((fee) => fee.cadence === "one-time");
  const usesPublishedTotal = apartment.publishedMonthlyTotal !== null && apartment.publishedMonthlyTotal !== undefined;
  const sum = (fees: Fee[]) => fees.reduce((total, fee) => total + (fee.amount ?? 0), 0);

  return {
    unclassifiedFees: included.filter((fee) => fee.cadence === "unknown"),
    conditionalFees: apartment.fees.filter((fee) => fee.applies === "optional" || fee.applies === "conditional"),
    usesPublishedTotal,
    rent: apartment.advertisedRent,
    monthlyFees,
    oneTimeFees,
    monthlyTotal: usesPublishedTotal ? apartment.publishedMonthlyTotal! : apartment.advertisedRent === null ? null : Math.round((apartment.advertisedRent + sum(monthlyFees)) * 100) / 100,
    monthlyHasEstimate: !usesPublishedTotal && monthlyFees.some((fee) => fee.basis === "estimated"),
    monthlyUnknownCount: monthlyFees.filter((fee) => fee.amount === null).length,
    oneTimeTotal: sum(oneTimeFees),
    oneTimeUnknownCount: oneTimeFees.filter((fee) => fee.amount === null).length,
    refundableTotal: sum(oneTimeFees.filter((fee) => fee.refundable)),
  };
}

function normalizeCadence(cadence: string | null): FeeCadence | null {
  const value = cadence?.toLowerCase() ?? "";
  if (/month|\/mo|recurring|installment/.test(value)) return "monthly";
  if (/once|one[- ]time|move[- ]in|upfront|deposit|application/.test(value)) return "one-time";
  return null;
}

/**
 * Maps a saved ApartmentProfile onto a comparison column. Fields the profile
 * does not carry (amenities, lease terms) stay empty and render as "Not listed".
 */
export function toComparisonApartment(profile: ApartmentProfile): ComparisonApartment {
  const plan = profile.floorplans[0];
  const fees: Fee[] = [];
  for (const fee of [...plan?.fees ?? [], ...profile.propertyFees ?? []]) {
    const cadence = normalizeCadence(fee.cadence);
    if (fees.some((existing) => existing.name.toLowerCase() === fee.name.toLowerCase())) continue;
    fees.push({
      name: fee.name,
      amount: fee.amount,
      cadence: cadence ?? "unknown",
      basis: fee.amount === null ? "unknown" : "published",
      refundable: /refundable/i.test(fee.conditions ?? "") && !/non-?refundable/i.test(fee.conditions ?? ""),
      applies: fee.applies,
      conditions: fee.conditions,
      sourceUrl: fee.sourceUrl,
      timing: fee.cadence,
    });
  }

  return {
    id: profile.placeId,
    profile,
    fetchedAt: profile.fetchedAt,
    name: profile.name,
    street: profile.address ?? "Address not listed",
    neighborhood: "West Campus",
    coords: null,
    advertisedRent: plan?.baseRent ?? null,
    rentBasis: plan?.rentBasis ?? "basis unknown",
    rentSourceUrl: plan?.sourceUrl,
    publishedMonthlyTotal: plan?.publishedMonthlyTotal,
    priceKind: plan?.priceKind,
    sourceKind: plan?.sourceKind,
    floorPlan: { beds: plan?.beds ?? null, baths: plan?.baths ?? null, note: plan?.name ?? null },
    walking: profile.campus.walking,
    cycling: profile.campus.cycling,
    amenities: [...new Set(profile.amenities?.map((amenity) => amenity.name) ?? [])],
    lease: { months: null, type: null, dates: plan?.leaseTerm ?? null },
    honestRating: profile.honestRating,
    honestCount: profile.honestCount,
    excludedTour: profile.excludedTour,
    googleRating: profile.googleRating,
    googleReviewCount: profile.googleReviewCount,
    fees,
    reviews: profile.reviews,
    sources: [...new Set([...profile.floorplans.flatMap((floorplan) => floorplan.sourceUrl ? [floorplan.sourceUrl] : []), ...profile.amenities?.map((amenity) => amenity.sourceUrl) ?? [], ...profile.propertyFees?.map((fee) => fee.sourceUrl) ?? []])],
    photoTone: "stucco",
    isSample: false,
  };
}
