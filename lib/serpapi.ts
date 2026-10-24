import { AsyncLocalStorage } from "node:async_hooks";

const SERP_ENDPOINT = "https://serpapi.com/search.json";
const MAX_SERP_CALLS = 24;

export const UT_TOWER_COORDS = "30.2862,-97.7394";

export type SerpBudgetExhausted = {
  error: "serp_budget_exhausted";
};

const budgetStore = new AsyncLocalStorage<{ count: number }>();

export function withSerpBudget<T>(fn: () => T | Promise<T>): Promise<T> {
  return Promise.resolve(budgetStore.run({ count: 0 }, fn));
}

export async function serpSearch(
  params: Record<string, string>,
): Promise<unknown> {
  const store = budgetStore.getStore();
  if (store && store.count >= MAX_SERP_CALLS) {
    return { error: "serp_budget_exhausted" } satisfies SerpBudgetExhausted;
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    throw new Error("SERPAPI_KEY is not set");
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "api_key") continue;
    query.set(key, value);
  }
  query.set("api_key", apiKey);
  query.set("output", "json");
  if (!query.has("hl")) query.set("hl", "en");
  if (!query.has("gl")) query.set("gl", "us");

  // Increment before awaiting so parallel calls cannot exceed the cap.
  if (store) store.count += 1;

  const response = await fetch(`${SERP_ENDPOINT}?${query.toString()}`, {
    cache: "no-store",
  });
  const body: unknown = await response.json();
  if (isRecord(body) && typeof body.error === "string") {
    throw new Error(body.error.split(apiKey).join("[redacted]"));
  }
  if (!response.ok) {
    throw new Error(`SerpAPI request failed (${response.status})`);
  }
  return body;
}

export type TravelMode = "walking" | "cycling";

export type TravelEndpoint =
  | string
  | {
      coords?: string | null;
      address?: string | null;
    };

export type TravelLeg = {
  distance: number;
  duration: number;
  formatted_distance: string;
  formatted_duration: string;
  travel_mode: string | number;
};

export type TravelTimeResult = TravelLeg | SerpBudgetExhausted | null;

const TRAVEL_MODE_PARAM: Record<TravelMode, string> = {
  walking: "2",
  cycling: "1",
};

const COORDINATE_PAIR = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/;

export function travelTimeBetween(
  start: TravelEndpoint,
  travelMode: TravelMode,
): Promise<TravelTimeResult>;
export function travelTimeBetween(
  start: TravelEndpoint,
  end: TravelEndpoint | undefined,
  travelMode: TravelMode,
): Promise<TravelTimeResult>;
export async function travelTimeBetween(
  start: TravelEndpoint,
  endOrMode: TravelEndpoint | TravelMode = UT_TOWER_COORDS,
  travelMode?: TravelMode,
): Promise<TravelTimeResult> {
  const { end, mode } = resolveTravelArgs(endOrMode, travelMode);
  const payload = await serpSearch({
    engine: "google_maps_directions",
    distance_unit: "1",
    hl: "en",
    gl: "us",
    travel_mode: TRAVEL_MODE_PARAM[mode],
    ...endpointParams("start", start),
    ...endpointParams("end", end),
  });
  if (isSerpBudgetExhausted(payload)) return payload;
  return readTravelLeg(payload);
}

function resolveTravelArgs(
  endOrMode: TravelEndpoint | TravelMode,
  travelMode: TravelMode | undefined,
): { end: TravelEndpoint; mode: TravelMode } {
  if (travelMode === undefined) {
    if (!isTravelMode(endOrMode)) {
      throw new Error(
        'travelTimeBetween requires travelMode "walking" or "cycling"',
      );
    }
    return { end: UT_TOWER_COORDS, mode: endOrMode };
  }
  if (isTravelMode(endOrMode)) {
    throw new Error("travelTimeBetween end must be coordinates or an address");
  }
  return { end: endOrMode, mode: travelMode };
}

function endpointParams(
  role: "start" | "end",
  endpoint: TravelEndpoint,
): Record<string, string> {
  const point = resolvePoint(endpoint);
  if (point.coords) return { [`${role}_coords`]: point.coords };
  if (point.address) return { [`${role}_addr`]: point.address };
  throw new Error(
    `travelTimeBetween requires ${role} coordinates or an address`,
  );
}

function resolvePoint(endpoint: TravelEndpoint): {
  coords?: string;
  address?: string;
} {
  if (typeof endpoint === "string") {
    const coords = coordinatePair(endpoint);
    if (coords) return { coords };
    const address = trimmed(endpoint);
    return address ? { address } : {};
  }

  const coords = coordinatePair(endpoint.coords ?? "");
  const address = trimmed(endpoint.address);
  return { coords, address };
}

function coordinatePair(value: string): string | undefined {
  const match = value.trim().match(COORDINATE_PAIR);
  if (!match) return undefined;
  return `${match[1]},${match[2]}`;
}

function trimmed(value: string | null | undefined): string | undefined {
  const next = value?.trim();
  return next ? next : undefined;
}

function readTravelLeg(payload: unknown): TravelLeg | null {
  if (!isRecord(payload) || !Array.isArray(payload.directions)) return null;
  if (payload.directions.length === 0) return null;
  const first = payload.directions[0];
  if (!isRecord(first)) return null;
  return {
    distance: first.distance as number,
    duration: first.duration as number,
    formatted_distance: first.formatted_distance as string,
    formatted_duration: first.formatted_duration as string,
    travel_mode: first.travel_mode as string | number,
  };
}

function isTravelMode(value: unknown): value is TravelMode {
  return value === "walking" || value === "cycling";
}

function isSerpBudgetExhausted(value: unknown): value is SerpBudgetExhausted {
  return isRecord(value) && value.error === "serp_budget_exhausted";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const ORGANIC_FIELDS = ["title", "link", "snippet"] as const;

export type OrganicResult = Partial<
  Record<(typeof ORGANIC_FIELDS)[number], string>
>;

function readOrganicResults(body: unknown): OrganicResult[] {
  if (!isRecord(body) || !Array.isArray(body.organic_results)) return [];
  const results: OrganicResult[] = [];
  for (const row of body.organic_results) {
    if (!isRecord(row)) continue;
    const picked: OrganicResult = {};
    for (const field of ORGANIC_FIELDS) {
      const value = row[field];
      if (typeof value === "string") picked[field] = value;
    }
    results.push(picked);
  }
  return results;
}

async function googleOrganicSearch(
  params: Record<string, string>,
): Promise<OrganicResult[] | SerpBudgetExhausted> {
  const body = await serpSearch({
    ...params,
    engine: "google",
    hl: "en",
    gl: "us",
  });
  if (isSerpBudgetExhausted(body)) return body;
  return readOrganicResults(body);
}

export function searchApartmentWebsites(
  title: string,
): Promise<OrganicResult[] | SerpBudgetExhausted> {
  return googleOrganicSearch({
    q: `${title} West Campus Austin apartment`,
    num: "5",
  });
}

export function searchApartmentLinks(
  title: string,
): Promise<OrganicResult[] | SerpBudgetExhausted> {
  return googleOrganicSearch({
    q: `"${title}" floor plan rent West Campus Austin`,
    num: "8",
  });
}

const APARTMENT_IMAGE_FIELDS = ["title", "link", "source"] as const;

export type ApartmentImage = {
  url: string;
} & Partial<Record<(typeof APARTMENT_IMAGE_FIELDS)[number], string>>;

function readImageField(
  row: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = row[field];
  if (typeof value !== "string") return undefined;
  const next = value.trim();
  return next.length > 0 ? next : undefined;
}

function readApartmentImage(body: unknown): ApartmentImage | null {
  if (!isRecord(body) || !Array.isArray(body.images_results)) return null;
  for (const row of body.images_results) {
    if (!isRecord(row)) continue;
    const url = readImageField(row, "original") ?? readImageField(row, "thumbnail");
    if (!url) continue;
    const image: ApartmentImage = { url };
    for (const field of APARTMENT_IMAGE_FIELDS) {
      const value = readImageField(row, field);
      if (value) image[field] = value;
    }
    return image;
  }
  return null;
}

export async function searchApartmentImage(
  title: string,
): Promise<ApartmentImage | SerpBudgetExhausted | null> {
  const body = await serpSearch({
    engine: "google_images",
    q: `${title} West Campus Austin apartment`,
    hl: "en",
    gl: "us",
  });
  if (isSerpBudgetExhausted(body)) return body;
  return readApartmentImage(body);
}

export const REVIEW_PAGE_SIZE = 20;
export const MAX_REVIEW_PAGES = 2;

const REVIEW_FIELDS = [
  "review_id",
  "rating",
  "snippet",
  "extracted_snippet",
  "iso_date",
  "date",
  "user",
  "link",
  "position",
] as const;

export type MapsReview = Partial<
  Record<(typeof REVIEW_FIELDS)[number], unknown>
>;

export type ApartmentReviews = {
  reviews: MapsReview[];
  place_info: { rating?: number };
};

function reviewSearchParams(
  placeId: string,
  nextPageToken?: string,
): Record<string, string> {
  const params: Record<string, string> = {
    engine: "google_maps_reviews",
    place_id: placeId,
    hl: "en",
    num: String(REVIEW_PAGE_SIZE),
    sort_by: "qualityScore",
  };
  if (nextPageToken) params.next_page_token = nextPageToken;
  return params;
}

function readPlaceRating(body: unknown): number | undefined {
  if (!isRecord(body) || !isRecord(body.place_info)) return undefined;
  const rating = body.place_info.rating;
  return typeof rating === "number" ? rating : undefined;
}

function readNextPageToken(body: unknown): string | undefined {
  if (!isRecord(body) || !isRecord(body.serpapi_pagination)) return undefined;
  const token = body.serpapi_pagination.next_page_token;
  return typeof token === "string" && token.length > 0 ? token : undefined;
}

function readReviews(body: unknown): MapsReview[] {
  if (!isRecord(body) || !Array.isArray(body.reviews)) return [];
  const reviews: MapsReview[] = [];
  for (const review of body.reviews) {
    if (!isRecord(review)) continue;
    const picked: MapsReview = {};
    for (const field of REVIEW_FIELDS) {
      if (Object.hasOwn(review, field)) picked[field] = review[field];
    }
    reviews.push(picked);
  }
  return reviews;
}

export async function fetchApartmentReviews(
  placeId: string,
): Promise<ApartmentReviews | SerpBudgetExhausted> {
  const reviews: MapsReview[] = [];
  const placeInfo: ApartmentReviews["place_info"] = {};
  let nextPageToken: string | undefined;

  for (let page = 0; page < MAX_REVIEW_PAGES; page += 1) {
    const body = await serpSearch(reviewSearchParams(placeId, nextPageToken));
    if (isSerpBudgetExhausted(body)) return body;

    if (page === 0) {
      const rating = readPlaceRating(body);
      if (rating !== undefined) placeInfo.rating = rating;
    }

    reviews.push(...readReviews(body));
    nextPageToken = readNextPageToken(body);
    if (!nextPageToken) break;
  }

  return { reviews, place_info: placeInfo };
}

const WEST_CAMPUS_LL = "@30.291,-97.752,15z";

export type MapsLocalResult = Record<string, unknown>;
export type MapsPlaceResult = Record<string, unknown>;

export async function searchWestCampusMaps(
  query: string,
): Promise<MapsLocalResult[] | SerpBudgetExhausted> {
  const body = await serpSearch({
    engine: "google_maps",
    type: "search",
    q: query,
    ll: WEST_CAMPUS_LL,
    hl: "en",
  });
  if (isSerpBudgetExhausted(body)) return body;
  return readLocalResults(body);
}

export async function getMapsPlace(
  placeId: string,
): Promise<MapsPlaceResult | SerpBudgetExhausted | null> {
  const body = await serpSearch({
    engine: "google_maps",
    place_id: placeId,
    hl: "en",
  });
  if (isSerpBudgetExhausted(body)) return body;
  if (!isRecord(body) || !isRecord(body.place_results)) return null;
  return body.place_results;
}

function readLocalResults(body: unknown): MapsLocalResult[] {
  if (!isRecord(body) || !Array.isArray(body.local_results)) return [];
  return body.local_results.filter(isRecord);
}
