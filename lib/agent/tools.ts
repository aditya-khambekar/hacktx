import "server-only";

import type OpenAI from "openai";
import {
  apartmentTransaction,
  isRecord,
  normalizeLabels,
  profileData,
  readProfile,
} from "../apartments";
import type { ApartmentProfile } from "../profile";
import { buildProfile } from "../profile";
import { searchApartmentWebsites, searchWestCampusMaps } from "../serpapi";

import { recommendApartments } from "../recommendations";
import { readRecommendationCriteria } from "../recommendation-criteria";

export const MAX_SUGGESTIONS = 3;

export const CHAT_PHASES = [
  "maps_search",
  "web_search",
  "place",
  "reviews",
  "directions_walking",
  "directions_cycling",
  "classify_reviews",
  "extract_listing",
] as const;

export type ChatPhase = (typeof CHAT_PHASES)[number];

export type ToolEmit = {
  status: (phase: ChatPhase) => void;
  suggestion: (profile: ApartmentProfile) => void;
};

type ToolName = "recommend_apartments" | "search_apartments" | "build_profile" | "save_apartment" | "add_label";

const TOOL_PARAMETERS: Record<ToolName, { description: string; parameters: Record<string, unknown> }> = {
  recommend_apartments: {
    description: "Find and rank apartments by enforced same-plan price, bedrooms, bathrooms and amenities. Use for criteria searches such as highest rated under $1100. Defaults: base rent per person, strictly under, resident ratings, exclude SMART restrictions. Returns at most 3 suggestions with actual provider and coverage.",
    parameters: { type: "object", additionalProperties: false, properties: {
      maxRent: { type: "number" }, beds: { type: "integer" }, baths: { type: "number" },
      amenities: { type: "array", items: { type: "string", enum: ["pets", "pool", "parking", "gym", "laundry", "furnished"] } },
      rankBy: { type: "string", enum: ["resident_rating", "google_rating", "lowest_price"] },
      priceScope: { type: "string", enum: ["base_rent", "required_recurring"] },
      priceBasis: { type: "string", enum: ["per person", "per unit"] },
      comparison: { type: "string", enum: ["under", "at_most"] },
      roomType: { type: "string", enum: ["any", "private", "shared"] }, allowSmart: { type: "boolean" },
      minRating: { type: "number" }, minReviewCount: { type: "integer" },
    } },
  },
  search_apartments: {
    description:
      "Search West Campus maps for apartments that are not already saved, then keep only places an Austin web result mentions. Returns at most 3 verified places. Does not build profiles or invent listings.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: {
          type: "string",
          description: "Maps search text. Put bedrooms, budget, and neighborhood in this string.",
        },
        beds: { type: "number", description: "Preferred bedroom count. Not applied as a Maps filter." },
        maxRent: { type: "number", description: "Maximum rent in dollars. Not applied as a Maps filter." },
      },
      required: ["query"],
    },
  },
  build_profile: {
    description:
      "Research one place id from search_apartments or from the user. Returns the profile and shows it as a suggestion. At most 3 suggestions per conversation turn. Do not pass rent or ratings.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        placeId: { type: "string", description: "Google Maps place id." },
      },
      required: ["placeId"],
    },
  },
  save_apartment: {
    description:
      "Save a profile built earlier in this conversation onto the signed-in user's board. Existing labels are kept. Do not pass rent, ratings, or labels.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        placeId: { type: "string", description: "Place id passed to build_profile in this conversation." },
      },
      required: ["placeId"],
    },
  },
  add_label: {
    description:
      "Add one label to an apartment this user already saved. The label is trimmed and lowercased. Empty labels and labels over 32 characters are rejected.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        placeId: { type: "string", description: "Place id of a saved apartment on this user's board." },
        label: { type: "string", description: "One label, at most 32 characters." },
      },
      required: ["placeId", "label"],
    },
  },
};

const ALLOWED_KEYS: Record<ToolName, readonly string[]> = {
  recommend_apartments: ["maxRent", "beds", "baths", "amenities", "rankBy", "priceScope", "priceBasis", "comparison", "roomType", "allowSmart", "minRating", "minReviewCount"],
  search_apartments: ["query", "beds", "maxRent"],
  build_profile: ["placeId"],
  save_apartment: ["placeId"],
  add_label: ["placeId", "label"],
};

export const agentTools: OpenAI.Responses.Tool[] = (Object.keys(TOOL_PARAMETERS) as ToolName[]).map(
  (name) => ({
    type: "function",
    name,
    description: TOOL_PARAMETERS[name].description,
    parameters: TOOL_PARAMETERS[name].parameters,
    strict: false,
  }),
);

export type ToolSession = {
  readonly suggestions: ApartmentProfile[];
  execute(name: string, argumentsJson: string): Promise<unknown>;
};

export function createToolSession(userId: string, emit: ToolEmit): ToolSession {
  const cache = new Map<string, ApartmentProfile>();
  const suggestions: ApartmentProfile[] = [];
  const recommendationState = { used: false };
  return {
    suggestions,
    execute(name, argumentsJson) {
      return executeAgentTool(name, argumentsJson, { userId, cache, suggestions, emit, recommendationState });
    },
  };
}

type SessionState = {
  recommendationState: { used: boolean };
  userId: string;
  cache: Map<string, ApartmentProfile>;
  suggestions: ApartmentProfile[];
  emit: ToolEmit;
};

async function executeAgentTool(
  name: string,
  argumentsJson: string,
  session: SessionState,
): Promise<unknown> {
  const args = parseArguments(argumentsJson);
  if ("error" in args) return args;
  if (Object.hasOwn(args, "userId")) return { error: "rejected_user_id" };
  if (!isToolName(name)) return { error: "unknown_tool" };
  if (Object.keys(args).some((key) => !ALLOWED_KEYS[name].includes(key))) {
    return { error: "rejected_argument" };
  }

  if (name === "recommend_apartments") {
    const criteria = readRecommendationCriteria(args);
    if (!criteria) return { error: "invalid_arguments" };
    if (session.recommendationState.used || session.suggestions.length) return { error: "suggestion_limit", instruction: "One criteria research pass per turn; use existing results." };
    session.recommendationState.used = true;
    const result = await recommendApartments(criteria, (phase) => session.emit.status(phase));
    for (const match of result.matches) {
      session.cache.set(match.profile.placeId, match.profile);
      session.suggestions.push(match.profile);
      session.emit.suggestion(match.profile);
    }
    return result;
  }
  if (name === "search_apartments") return searchApartments(args, session.emit);
  if (name === "build_profile") return buildProfileTool(args, session);
  if (name === "save_apartment") return saveApartment(args, session);
  return addLabel(args, session);
}

function parseArguments(argumentsJson: string): Record<string, unknown> | { error: "invalid_arguments" } {
  try {
    const value: unknown = JSON.parse(argumentsJson);
    if (!isRecord(value)) return { error: "invalid_arguments" };
    return value;
  } catch {
    return { error: "invalid_arguments" };
  }
}

function isToolName(name: string): name is ToolName {
  return Object.hasOwn(ALLOWED_KEYS, name);
}

async function searchApartments(args: Record<string, unknown>, emit: ToolEmit): Promise<unknown> {
  const query = typeof args.query === "string" ? args.query.trim() : "";
  if (!query || query.length > 200) return { error: "invalid_arguments", verified: [] };
  if (args.beds !== undefined && !isOptionalNumber(args.beds)) {
    return { error: "invalid_arguments", verified: [] };
  }
  if (args.maxRent !== undefined && !isOptionalNumber(args.maxRent)) {
    return { error: "invalid_arguments", verified: [] };
  }

  emit.status("maps_search");
  let locals: unknown;
  try {
    locals = await searchWestCampusMaps(query);
  } catch {
    return { error: "search_failed", verified: [] };
  }
  if (!Array.isArray(locals)) return { error: "serp_budget_exhausted", verified: [] };

  const candidates: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const row of locals) {
    if (!isRecord(row)) continue;
    const place = pickPlace(row);
    if (!place) continue;
    const placeId = place.place_id;
    if (typeof placeId !== "string" || seen.has(placeId)) continue;
    seen.add(placeId);
    candidates.push(place);
    if (candidates.length === MAX_SUGGESTIONS) break;
  }

  const verified: Record<string, unknown>[] = [];
  let budgetExhausted = false;
  if (candidates.some((place) => typeof place.title === "string" && place.title.trim())) {
    emit.status("web_search");
  }
  for (const place of candidates) {
    const title = typeof place.title === "string" ? place.title.trim() : "";
    if (!title) continue;
    let organic: unknown;
    try {
      organic = await searchApartmentWebsites(title);
    } catch {
      return { error: "search_failed", verified };
    }
    if (!Array.isArray(organic)) {
      budgetExhausted = true;
      break;
    }
    if (mentionsTitleAndAustin(title, organic)) verified.push(place);
  }

  if (budgetExhausted) return { error: "serp_budget_exhausted", verified };
  return { verified };
}

function pickPlace(row: Record<string, unknown>): Record<string, unknown> | null {
  if (typeof row.place_id !== "string" || !row.place_id.trim()) return null;
  const place: Record<string, unknown> = { place_id: row.place_id };
  if (typeof row.title === "string") place.title = row.title;
  if (typeof row.data_id === "string") place.data_id = row.data_id;
  if (typeof row.address === "string") place.address = row.address;
  if (isRecord(row.gps_coordinates)) {
    const coords: Record<string, number> = {};
    if (typeof row.gps_coordinates.latitude === "number") coords.latitude = row.gps_coordinates.latitude;
    if (typeof row.gps_coordinates.longitude === "number") coords.longitude = row.gps_coordinates.longitude;
    if (Object.keys(coords).length) place.gps_coordinates = coords;
  }
  if (typeof row.rating === "number") place.rating = row.rating;
  if (typeof row.reviews === "number") place.reviews = row.reviews;
  if (typeof row.type === "string" || Array.isArray(row.type)) place.type = row.type;
  return place;
}

function mentionsTitleAndAustin(title: string, results: unknown[]): boolean {
  const needle = title.toLowerCase();
  return results.some((result) => {
    if (!isRecord(result)) return false;
    return [result.title, result.snippet].some((field) => {
      if (typeof field !== "string") return false;
      const hay = field.toLowerCase();
      return hay.includes(needle) && hay.includes("austin");
    });
  });
}

function isOptionalNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

async function buildProfileTool(args: Record<string, unknown>, session: SessionState): Promise<unknown> {
  const placeId = typeof args.placeId === "string" ? args.placeId.trim() : "";
  if (!placeId || placeId.length > 256) return { error: "invalid_arguments" };
  const cached = session.cache.get(placeId);
  if (cached) return cached;
  if (session.suggestions.length >= MAX_SUGGESTIONS) return { error: "suggestion_limit" };

  try {
    const profile = await buildProfile(placeId, (phase) => session.emit.status(phase));
    session.cache.set(placeId, profile);
    if (session.suggestions.length < MAX_SUGGESTIONS) {
      session.suggestions.push(profile);
      session.emit.suggestion(profile);
    }
    return profile;
  } catch (error) {
    if (error instanceof Error && error.message === "serp_budget_exhausted") {
      return { error: "serp_budget_exhausted" };
    }
    return { error: "profile_failed" };
  }
}

async function saveApartment(args: Record<string, unknown>, session: SessionState): Promise<unknown> {
  const placeId = typeof args.placeId === "string" ? args.placeId.trim() : "";
  if (!placeId) return { error: "invalid_arguments" };
  const cached = session.cache.get(placeId);
  if (!cached) return { error: "profile_not_built" };
  const saved = readProfile(cached);
  if (!saved) return { error: "profile_invalid" };

  const where = { userId_placeId: { userId: session.userId, placeId: saved.placeId } };
  const apartment = await apartmentTransaction(async (tx) => {
    const existing = await tx.apartment.findUnique({ where, select: { labels: true } });
    // Same write as POST /api/apartments: a later save must not erase labels.
    const data = profileData({ ...saved, labels: existing?.labels ?? saved.labels });
    return tx.apartment.upsert({
      where,
      create: { userId: session.userId, placeId: saved.placeId, ...data },
      update: data,
      select: { placeId: true, name: true, labels: true },
    });
  });
  return {
    saved: true,
    placeId: apartment.placeId,
    name: apartment.name,
    labels: apartment.labels,
  };
}

async function addLabel(args: Record<string, unknown>, session: SessionState): Promise<unknown> {
  const placeId = typeof args.placeId === "string" ? args.placeId.trim() : "";
  if (!placeId || typeof args.label !== "string") return { error: "invalid_arguments" };
  const normalized = normalizeLabels([args.label]);
  if (!normalized) return { error: "invalid_label" };
  const label = normalized[0];

  const outcome = await apartmentTransaction(async (tx) => {
    const existing = await tx.apartment.findUnique({
      where: { userId_placeId: { userId: session.userId, placeId } },
      select: { id: true, labels: true, profile: true },
    });
    if (!existing) return null;
    const profile = readProfile(existing.profile);
    if (!profile) return { error: "profile_invalid" as const };
    const labels = existing.labels.some((item) => item.trim().toLowerCase() === label)
      ? existing.labels
      : [...existing.labels, label];
    if (labels === existing.labels) return { placeId, labels };
    await tx.apartment.update({
      where: { id: existing.id },
      data: { labels, profile: { ...profile, labels } },
    });
    return { placeId, labels };
  });

  if (!outcome) return { error: "not_saved" };
  return outcome;
}
