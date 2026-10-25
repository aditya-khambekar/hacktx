// Mirrors the ApartmentProfile in architecture.md. Null means the source did not say.
export type RouteLeg = {
  distanceMeters: number;
  durationSeconds: number;
  formattedDistance: string;
  formattedDuration: string;
};

export type ApartmentProfile = {
  placeId: string;
  name: string;
  address: string | null;
  mapsUrl: string;
  website: string | null;
  phone: string | null;
  labels: string[];
  fetchedAt: string;
  googleRating: number | null;
  googleReviewCount: number | null;
  honestRating: number | null;
  honestCount: number;
  excludedTour: number;
  unclearCount: number;
  campus: {
    destination: "UT Tower";
    endCoords: "30.2862,-97.7394";
    walking: RouteLeg | null;
    cycling: RouteLeg | null;
  };
  floorplans: Array<{
    name: string | null;
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    baseRent: number | null;
    rentBasis?: "per person" | "per unit" | null;
    sourceUrl: string | null;
    fees: Array<{ name: string; amount: number | null; cadence: string | null }>;
  }>;
  reviews: Array<{
    id: string;
    rating: number;
    text: string;
    date: string | null;
    author: string | null;
    link: string | null;
    about: "tour" | "apartment" | "unclear";
    reason: string;
  }>;
  amenities?: Array<{ name: string; sourceUrl: string }>;
  propertyFees?: Array<{ name: string; amount: number | null; cadence: string | null; sourceUrl: string }>;
  sources: string[];
};

export type FeeCadence = "monthly" | "one-time" | "unknown";

/** published: a source states the number. estimated: our estimate. unknown: no number found. */
export type FeeBasis = "published" | "estimated" | "unknown";

export type Fee = {
  name: string;
  amount: number | null;
  cadence: FeeCadence;
  basis: FeeBasis;
  refundable?: boolean;
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
