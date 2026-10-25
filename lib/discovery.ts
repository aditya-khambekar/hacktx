import "server-only";

import { buildProfile } from "./profile";
import type { ApartmentProfile } from "./profile";
import { findCuratedApartment, withCuratedApartment } from "./curated-apartments";
import { getMapsPlace, searchApartmentWebsites, serpSearch } from "./serpapi";

const PAGE_SIZE = 20;
const MAX_OFFSET = 100;
const WEST_CAMPUS_LL = "@30.291,-97.752,15z";
const DEFAULT_QUERY = "West Campus apartments near UT Austin";

export type ApartmentCandidate = {
  placeId: string;
  name: string;
  address: string | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  mapsUrl: string;
};

export type ApartmentSearchResults = {
  query: string;
  apartments: ApartmentCandidate[];
  nextStart: number | null;
};

export class DiscoveryError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code); }
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function checkBudget(value: unknown) {
  if (record(value).error === "serp_budget_exhausted") {
    throw new DiscoveryError("serp_budget_exhausted", 503);
  }
}

function isNonProperty(place: Record<string, unknown>) {
  const types = [place.type, ...(Array.isArray(place.types) ? place.types : [])].flat();
  return types.some((type) => typeof type === "string"
    && /real estate agenc|real estate agent|property management company|neighborhood|^university$|^college$/i.test(type))
    || /^austin\s*,?\s*(tx|texas)\b/i.test(text(place.address) ?? "")
    || /\bPMB\s*#?\s*\d+/i.test(text(place.address) ?? "");
}

// Keep discovery near UT, even if a Maps search returns similarly named places elsewhere.
function nearUT(place: Record<string, unknown>) {
  const coords = record(place.gps_coordinates);
  const lat = numeric(coords.latitude);
  const lng = numeric(coords.longitude);
  if (lat === null || lng === null) return /\baustin\b/i.test(text(place.address) ?? "");
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const a = Math.sin(radians(lat - 30.2862) / 2) ** 2
    + Math.cos(radians(30.2862)) * Math.cos(radians(lat))
    * Math.sin(radians(lng + 97.7394) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a))) <= 8;
}

export function readSearchInput(value: unknown): { query: string; start: number } | null {
  const body = record(value);
  if (value === null || typeof value !== "object" || Array.isArray(value)
    || Object.keys(body).some((key) => key !== "query" && key !== "start")) return null;
  const query = body.query === undefined ? "" : body.query;
  const start = body.start === undefined ? 0 : body.start;
  if (typeof query !== "string" || query.length > 200
    || typeof start !== "number" || !Number.isInteger(start)
    || start < 0 || start > MAX_OFFSET || start % PAGE_SIZE !== 0) return null;
  return { query: query.trim(), start };
}

/** A cheap Maps page; full review/model work runs only when a result is selected. */
export async function discoverApartments(query: string, start = 0): Promise<ApartmentSearchResults> {
  const scopedQuery = query ? `${query} apartments near UT Austin` : DEFAULT_QUERY;
  const payload = await serpSearch({
    engine: "google_maps", type: "search", q: scopedQuery,
    ll: WEST_CAMPUS_LL, hl: "en", ...(start ? { start: String(start) } : {}),
  });
  checkBudget(payload);
  const body = record(payload);
  const rows: unknown[] = Array.isArray(body.local_results) ? body.local_results
    : body.place_results ? [body.place_results] : [];
  const seen = new Set<string>();
  const apartments: ApartmentCandidate[] = [];
  for (const value of rows) {
    const place = record(value);
    const placeId = text(place.place_id);
    const name = text(place.title);
    if (!placeId || !name || seen.has(placeId) || !nearUT(place) || isNonProperty(place)) continue;
    seen.add(placeId);
    const rating = numeric(place.rating);
    const count = numeric(place.reviews);
    apartments.push({
      placeId, name, address: text(place.address),
      googleRating: rating !== null && rating >= 0 && rating <= 5 ? rating : null,
      googleReviewCount: count !== null && Number.isInteger(count) && count >= 0 ? count : null,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(placeId)}`,
    });
  }
  // Read only pagination presence. Never follow a provider-supplied URL with credentials.
  const hasNext = text(record(body.serpapi_pagination).next) !== null;
  return { query, apartments, nextStart: hasNext && start < MAX_OFFSET ? start + PAGE_SIZE : null };
}

/** Verify an Austin listing before spending calls on its complete profile. */
export async function buildDiscoveredProfile(placeId: string) {
  const place = await getMapsPlace(placeId);
  checkBudget(place);
  if (!place) throw new DiscoveryError("place_not_found", 404);
  const details = record(place);
  const title = text(details.title);
  if (!title || !nearUT(details) || isNonProperty(details)) throw new DiscoveryError("listing_unverified", 422);

  // Maps still verifies the selected place. Curated facts remain usable if the
  // separate model/review research fails; never fabricate missing live results.
  if (findCuratedApartment(title, text(details.address))) {
    try {
      return await buildProfile(placeId);
    } catch {
      const rating = numeric(details.rating);
      const count = numeric(details.reviews);
      const profile: ApartmentProfile = {
        placeId, name: title, address: text(details.address),
        mapsUrl: `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(placeId)}`,
        website: text(details.website), phone: text(details.phone), labels: [],
        fetchedAt: new Date().toISOString(), googleRating: rating !== null && rating >= 0 && rating <= 5 ? rating : null,
        googleReviewCount: count !== null && count >= 0 && Number.isInteger(count) ? count : null,
        honestRating: null, honestCount: 0, excludedTour: 0, unclearCount: 0,
        campus: { destination: "UT Tower", endCoords: "30.2862,-97.7394", walking: null, cycling: null },
        floorplans: [], reviews: [], amenities: [], propertyFees: [], sources: [],
      };
      return withCuratedApartment(profile);
    }
  }

  const results = await searchApartmentWebsites(title);
  checkBudget(results);
  if (!Array.isArray(results)) throw new DiscoveryError("serp_budget_exhausted", 503);
  const name = title.toLowerCase();
  const verified = results.some((result) => [result.title, result.snippet].some((value) =>
    typeof value === "string" && value.toLowerCase().includes(name) && /\baustin\b/i.test(value),
  ));
  if (!verified) throw new DiscoveryError("listing_unverified", 422);
  const profile = await buildProfile(placeId);
  const verificationUrl = new URL("https://serpapi.com/search.json");
  verificationUrl.search = new URLSearchParams({
    engine: "google", q: `${title} West Campus Austin apartment`, hl: "en", gl: "us", num: "5",
  }).toString();
  return { ...profile, sources: [...new Set([...profile.sources, verificationUrl.toString()])] };
}

export function discoveryFailure(error: unknown, fallback: string, status = 502) {
  const code = error instanceof DiscoveryError ? error.code : fallback;
  console.error("[discovery]", { operation: fallback, code });
  return Response.json({ error: code }, {
    status: error instanceof DiscoveryError ? error.status : status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
