// SAMPLE DATA. Fictional apartments for building the workspace before the
// backend is connected. Names, prices, fees, scores, and routes are illustrative.
import type { ComparisonApartment, Preference, RouteLeg } from "./types";

function leg(meters: number, seconds: number): RouteLeg {
  const miles = meters / 1609.34;
  return {
    distanceMeters: meters,
    durationSeconds: seconds,
    formattedDistance: `${miles.toFixed(1)} mi`,
    formattedDuration: `${Math.round(seconds / 60)} min`,
  };
}

const juniper: ComparisonApartment = {
  id: "sample-juniper",
  name: "Juniper on 24th",
  street: "W 24th St",
  neighborhood: "West Campus",
  coords: { lat: 30.2876, lng: -97.7446 },
  advertisedRent: 1295,
  rentBasis: "per person",
  floorPlan: { beds: 2, baths: 2, note: "Private bedroom & bathroom" },
  walking: leg(640, 480),
  cycling: leg(700, 180),
  amenities: ["In-unit laundry", "Furnished", "Study lounge", "Bike storage"],
  lease: { months: 12, type: "Individual", dates: "Aug 2027 – Jul 2028" },
  honestRating: 3.8,
  honestCount: 46,
  excludedTour: 31,
  googleRating: 4.2,
  googleReviewCount: 77,
  fees: [
    { name: "Utilities", amount: 75, cadence: "monthly", basis: "estimated" },
    { name: "Parking", amount: null, cadence: "monthly", basis: "unknown" },
    { name: "Application fee", amount: 75, cadence: "one-time", basis: "published" },
    { name: "Admin fee", amount: null, cadence: "one-time", basis: "unknown" },
    { name: "Security deposit", amount: 500, cadence: "one-time", basis: "published", refundable: true },
  ],
  photoTone: "stucco",
  isSample: true,
};

const nueces: ComparisonApartment = {
  id: "sample-nueces",
  name: "The Nueces",
  street: "Nueces St",
  neighborhood: "West Campus",
  coords: { lat: 30.2896, lng: -97.7457 },
  advertisedRent: 1375,
  rentBasis: "per person",
  floorPlan: { beds: 2, baths: 2, note: "Private bedroom & bathroom" },
  walking: leg(965, 720),
  cycling: leg(1050, 240),
  amenities: ["In-unit laundry", "Furnished", "Pool", "Gym", "Study rooms"],
  lease: { months: 12, type: "Individual", dates: "Aug 2027 – Jul 2028" },
  honestRating: 4.1,
  honestCount: 63,
  excludedTour: 52,
  googleRating: 4.4,
  googleReviewCount: 115,
  fees: [
    { name: "Utilities", amount: 95, cadence: "monthly", basis: "estimated" },
    { name: "Parking", amount: null, cadence: "monthly", basis: "unknown" },
    { name: "Application fee", amount: 50, cadence: "one-time", basis: "published" },
    { name: "Admin fee", amount: null, cadence: "one-time", basis: "unknown" },
    { name: "Security deposit", amount: 300, cadence: "one-time", basis: "published", refundable: true },
  ],
  photoTone: "brick",
  isSample: true,
};

const alder: ComparisonApartment = {
  id: "sample-alder",
  name: "Alder House",
  street: "San Gabriel St",
  neighborhood: "West Campus",
  coords: { lat: 30.2906, lng: -97.7491 },
  advertisedRent: 1150,
  rentBasis: "per person",
  floorPlan: { beds: 2, baths: 1, note: "Private bedroom · Shared bath" },
  walking: leg(1290, 960),
  cycling: leg(1400, 300),
  amenities: ["In-unit laundry", "Unfurnished", "Courtyard", "Bike storage"],
  lease: { months: 10, type: "Joint", dates: "Aug 2027 – May 2028" },
  honestRating: 3.6,
  honestCount: 22,
  excludedTour: 9,
  googleRating: 4.0,
  googleReviewCount: 34,
  fees: [
    { name: "Utilities", amount: 65, cadence: "monthly", basis: "estimated" },
    { name: "Parking", amount: null, cadence: "monthly", basis: "unknown" },
    { name: "Application fee", amount: 45, cadence: "one-time", basis: "published" },
    { name: "Admin fee", amount: null, cadence: "one-time", basis: "unknown" },
    { name: "Security deposit", amount: 1150, cadence: "one-time", basis: "published", refundable: true },
  ],
  photoTone: "timber",
  isSample: true,
};

const pearl: ComparisonApartment = {
  id: "sample-pearl",
  name: "Pearl Street Commons",
  street: "Pearl St",
  neighborhood: "West Campus",
  coords: { lat: 30.2921, lng: -97.7476 },
  advertisedRent: 1240,
  rentBasis: "per person",
  floorPlan: { beds: 4, baths: 4, note: "Private bedroom & bathroom" },
  walking: leg(1210, 900),
  cycling: leg(1300, 270),
  amenities: ["In-unit laundry", "Furnished", "Rooftop deck"],
  lease: { months: 12, type: "Individual", dates: "Aug 2027 – Jul 2028" },
  honestRating: null,
  honestCount: 0,
  excludedTour: 18,
  googleRating: 4.7,
  googleReviewCount: 18,
  fees: [
    { name: "Utilities", amount: 60, cadence: "monthly", basis: "estimated" },
    { name: "Technology fee", amount: 20, cadence: "monthly", basis: "published" },
    { name: "Application fee", amount: 100, cadence: "one-time", basis: "published" },
    { name: "Security deposit", amount: null, cadence: "one-time", basis: "unknown", refundable: true },
  ],
  photoTone: "brick",
  isSample: true,
};

const rio: ComparisonApartment = {
  id: "sample-rio",
  name: "Rio Flats",
  street: "Rio Grande St",
  neighborhood: "West Campus",
  coords: { lat: 30.2884, lng: -97.7431 },
  advertisedRent: 1420,
  rentBasis: "per person",
  floorPlan: { beds: 1, baths: 1, note: "Studio-style one bedroom" },
  walking: leg(560, 420),
  cycling: leg(620, 150),
  amenities: ["In-unit laundry", "Unfurnished", "Bike storage"],
  lease: { months: 12, type: "Individual", dates: "Aug 2027 – Jul 2028" },
  honestRating: 4.3,
  honestCount: 29,
  excludedTour: 4,
  googleRating: 4.3,
  googleReviewCount: 33,
  fees: [
    { name: "Utilities", amount: 110, cadence: "monthly", basis: "estimated" },
    { name: "Pest control", amount: 5, cadence: "monthly", basis: "published" },
    { name: "Application fee", amount: 60, cadence: "one-time", basis: "published" },
    { name: "Admin fee", amount: 250, cadence: "one-time", basis: "published" },
    { name: "Security deposit", amount: 400, cadence: "one-time", basis: "published", refundable: true },
  ],
  photoTone: "stucco",
  isSample: true,
};

/** Shown on load, in the order they were "added". */
export const SAMPLE_SHORTLIST: ComparisonApartment[] = [juniper, nueces, alder];

/** Available from the Add apartment dialog. */
export const SAMPLE_CATALOG: ComparisonApartment[] = [juniper, nueces, alder, pearl, rio];

export const SAMPLE_PREFERENCES: Preference[] = [
  { id: "budget", label: "Up to $1,400 / person" },
  { id: "beds", label: "2 bedrooms" },
  { id: "walk", label: "Walk to campus" },
  { id: "laundry", label: "In-unit laundry" },
  { id: "move-in", label: "August 2027" },
];

