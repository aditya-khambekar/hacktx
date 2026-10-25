import type { CuratedPlan } from "./curated-types";

export type ListingFee = {
  name: string;
  amount: number | null;
  cadence: string | null;
  sourceUrl?: string;
  applies?: "required" | "optional" | "conditional";
  conditions?: string | null;
};

export type ListingFloorplan = {
  curated?: CuratedPlan;
  name: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  baseRent: number | null;
  rentBasis?: "per person" | "per unit" | null;
  /** Published inclusive installment; never add itemized fees to it again. */
  publishedMonthlyTotal?: number | null;
  priceKind?: "starting at" | "exact" | "range" | null;
  leaseTerm?: string | null;
  sourceKind?: "official page" | "search snippet";
  sourceUrl: string | null;
  fees: ListingFee[];
};

export const PRICING_VERSION = 1;
