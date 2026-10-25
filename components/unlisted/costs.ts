import type { ApartmentProfile, ComparisonApartment, Fee, FeeCadence } from "./types";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatUsd(amount: number) {
  return usd.format(amount);
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
};

export function summarizeCosts(apartment: ComparisonApartment): CostSummary {
  const monthlyFees = apartment.fees.filter((fee) => fee.cadence === "monthly");
  const oneTimeFees = apartment.fees.filter((fee) => fee.cadence === "one-time");
  const sum = (fees: Fee[]) => fees.reduce((total, fee) => total + (fee.amount ?? 0), 0);

  return {
    unclassifiedFees: apartment.fees.filter((fee) => fee.cadence === "unknown"),
    rent: apartment.advertisedRent,
    monthlyFees,
    oneTimeFees,
    monthlyTotal: apartment.advertisedRent === null ? null : apartment.advertisedRent + sum(monthlyFees),
    monthlyHasEstimate: monthlyFees.some((fee) => fee.basis === "estimated"),
    monthlyUnknownCount: monthlyFees.filter((fee) => fee.amount === null).length,
    oneTimeTotal: sum(oneTimeFees),
    oneTimeUnknownCount: oneTimeFees.filter((fee) => fee.amount === null).length,
    refundableTotal: sum(oneTimeFees.filter((fee) => fee.refundable)),
  };
}

function normalizeCadence(cadence: string | null): FeeCadence | null {
  const value = cadence?.toLowerCase() ?? "";
  if (/month|\/mo|recurring/.test(value)) return "monthly";
  if (/once|one[- ]time|move[- ]in|upfront|deposit|application/.test(value)) return "one-time";
  return null;
}

/** Maps a saved ApartmentProfile onto a comparison column. */
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
      refundable: /deposit/i.test(fee.name) && !/non-?refundable/i.test(fee.name),
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
    floorPlan: { beds: plan?.beds ?? null, baths: plan?.baths ?? null, note: plan?.name ?? null },
    walking: profile.campus.walking,
    cycling: profile.campus.cycling,
    amenities: [...new Set(profile.amenities?.map((amenity) => amenity.name) ?? [])],
    lease: {
      months: profile.lease?.months ?? null,
      type: profile.lease?.type ?? null,
      dates: profile.lease?.dates ?? null,
    },
    honestRating: profile.honestRating,
    honestCount: profile.honestCount,
    excludedTour: profile.excludedTour,
    googleRating: profile.googleRating,
    googleReviewCount: profile.googleReviewCount,
    fees,
    reviews: profile.reviews,
    sources: [...new Set([
      ...profile.floorplans.flatMap((floorplan) => floorplan.sourceUrl ? [floorplan.sourceUrl] : []),
      ...profile.amenities?.map((amenity) => amenity.sourceUrl) ?? [],
      ...profile.propertyFees?.map((fee) => fee.sourceUrl) ?? [],
      ...profile.lease?.sourceUrl ? [profile.lease.sourceUrl] : [],
    ])],
    photoTone: "stucco",
    isSample: false,
  };
}
