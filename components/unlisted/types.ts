import type { ApartmentProfile } from "../../lib/profile";
export type { ApartmentProfile, RouteLeg } from "../../lib/profile";
import type { RouteLeg } from "../../lib/profile";

export type FeeCadence = "monthly" | "one-time" | "unknown";

/** published: a source states the number. estimated: our estimate. unknown: no number found. */
export type FeeBasis = "published" | "estimated" | "unknown";

export type Fee = {
  name: string;
  amount: number | null;
  cadence: FeeCadence;
  basis: FeeBasis;
  refundable?: boolean;
  applies?: "required" | "optional" | "conditional";
  conditions?: string | null;
  sourceUrl?: string;
  timing?: string | null;
};

/** The view model one comparison column renders. */
export type ComparisonApartment = {
  id: string;
  profile?: ApartmentProfile;
  databaseId?: string;
  fetchedAt?: string;
  researchStatus?: "loading" | "error" | "ready";
  researchError?: string;
  name: string;
  street: string;
  neighborhood: string;
  coords: { lat: number; lng: number } | null;
  advertisedRent: number | null;
  rentBasis: "per person" | "per unit" | "basis unknown";
  rentSourceUrl?: string | null;
  publishedMonthlyTotal?: number | null;
  priceKind?: "starting at" | "exact" | "range" | null;
  sourceKind?: "official page" | "search snippet";
  floorPlan: { beds: number | null; baths: number | null; note: string | null };
  walking: RouteLeg | null;
  cycling: RouteLeg | null;
  amenities: string[];
  lease: { months: number | null; type: string | null; dates: string | null };
  honestRating: number | null;
  honestCount: number;
  excludedTour: number;
  googleRating: number | null;
  googleReviewCount: number | null;
  fees: Fee[];
  reviews?: ApartmentProfile["reviews"];
  sources?: string[];
  photoTone: "brick" | "stucco" | "timber";
  isSample: boolean;
};

export type Preference = { id: string; label: string };
