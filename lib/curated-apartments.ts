import { curatedApartmentData } from "./curated-apartment-data";
import type { CuratedProperty } from "./curated-types";
import type { ApartmentProfile } from "./profile";

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Fail closed for lookalikes and ambiguous Block locations. Never use a fuzzy match. */
export function findCuratedApartment(name: string, address: string | null): CuratedProperty | null {
  const title = normalize(name);
  const street = normalize(address ?? "");
  if (street && !/\baustin\b|\b787\d{2}\b/.test(street)) return null;
  const byId = (id: string) => curatedApartmentData.find((item) => item.id === id) ?? null;
  if (/^(ion austin|ion at austin)( apartments| student apartments| student living| student housing)?$/.test(title)) return byId("ion-austin");
  if (/^(the )?union on san antonio( apartments| student apartments)?$/.test(title)) return byId("union-san-antonio");
  if (/^moontower( austin| apartments| student apartments| austin apartments| apartments austin)?$/.test(title)) return byId("moontower");
  if (!/^(the )?block\b/.test(title)) return null;
  const locations: Array<[string, RegExp]> = [
    ["block-25th-e", /\b25th (e|east)\b/], ["block-25th-w", /\b25th (w|west)\b/],
    ["block-pearl-n", /\bpearl (n|north)\b/], ["block-pearl-s", /\bpearl (s|south)\b/],
    ["block-23rd", /\b23rd\b/], ["block-28th", /\b28th\b/],
    ["block-leon", /\bleon\b/], ["block-rio", /\brio( grande)?\b/],
  ];
  const fromName = locations.filter(([, pattern]) => pattern.test(title)).map(([id]) => id);
  const fromAddress = curatedApartmentData.filter((item) => item.id.startsWith("block-") && item.address && street.startsWith(normalize(item.address.split(",")[0]))).map((item) => item.id);
  const matches = [...new Set([...fromName, ...fromAddress])];
  return matches.length === 1 ? byId(matches[0]) : null;
}

/** Used only on the server: client-provided curated metadata is never authoritative. */
export function withCuratedApartment(profile: ApartmentProfile): ApartmentProfile {
  const property = findCuratedApartment(profile.name, profile.address);
  if (!property) return profile;
  const { floorplans, ...curated } = property;
  const provenance = property.sourceUrl ?? `curated:${property.id}`;
  const curatedPlans = floorplans.map((plan) => ({
    name: [plan.name, !plan.name.includes(plan.variant) && plan.variant !== "Standard" && plan.variant !== "Starting at" ? plan.variant : null].filter(Boolean).join(" · "),
    beds: plan.beds, baths: plan.baths, sqft: plan.sqft, baseRent: plan.baseRent,
    rentBasis: plan.rentBasis, sourceUrl: plan.sourceUrl ?? provenance, fees: [],
    curated: plan,
  }));
  // Keep an already-selected trusted layout first when saving a recommendation.
  // Match source values, never trust client-authored curated IDs or prices.
  const selected = profile.floorplans[0];
  const selectedIndex = selected ? curatedPlans.findIndex((plan) => plan.name === selected.name && plan.baseRent === selected.baseRent && plan.beds === selected.beds && plan.baths === selected.baths) : -1;
  if (selectedIndex > 0) curatedPlans.unshift(...curatedPlans.splice(selectedIndex, 1));
  const propertyFees = property.fees.filter((fee) => fee.requirement === "required").map((fee) => ({
    name: fee.name, amount: fee.amount, cadence: fee.cadence, sourceUrl: provenance,
  }));
  return {
    ...profile,
    address: profile.address ?? property.address,
    website: profile.website ?? property.website,
    floorplans: curatedPlans,
    // Curated amenities extend live evidence; unprovided features are never invented.
    amenities: [...new Map([
      ...(profile.amenities ?? []),
      ...property.amenities.map((name) => ({ name, sourceUrl: provenance })),
    ].map((item) => [item.name.toLowerCase(), item])).values()],
    propertyFees,
    curated,
    sources: [...new Set([...profile.sources, provenance, ...curatedPlans.map((plan) => plan.sourceUrl)])],
  };
}
