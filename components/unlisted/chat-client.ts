import { toComparisonApartment } from "./costs";
import type { ApartmentProfile, ComparisonApartment } from "./types";

/** Matches the agent cap. The panel never shows more cards than this. */
export const MAX_SUGGESTION_CARDS = 3;

export const SIGN_IN_COPY = "Sign in to talk with the housing assistant.";

const CHAT_PHASES = [
  "maps_search",
  "web_search",
  "place",
  "reviews",
  "directions_walking",
  "directions_cycling",
  "classify_reviews",
  "extract_listing",
  "site_research",
] as const;

export type ChatPhase = (typeof CHAT_PHASES)[number];

const PHASE_LABEL: Record<ChatPhase, string> = {
  maps_search: "Searching maps…",
  web_search: "Checking the web…",
  place: "Looking up the place…",
  reviews: "Reading reviews…",
  directions_walking: "Checking the walk to the UT Tower…",
  directions_cycling: "Checking the bike ride to the UT Tower…",
  classify_reviews: "Sorting reviews…",
  extract_listing: "Reading the listing…",
  site_research: "Reading the property website…",
};

export type ChatStreamEvent = { event: string; data: unknown };

export function chatPhaseLabel(phase: string | null): string {
  if (phase === null) return "Looking at your board…";
  if (isChatPhase(phase)) return PHASE_LABEL[phase];
  return phase;
}

export function isChatPhase(value: unknown): value is ChatPhase {
  return typeof value === "string" && (CHAT_PHASES as readonly string[]).includes(value);
}

export function chatFailureCopy(code: string): string {
  if (code === "unauthorized") return SIGN_IN_COPY;
  if (code === "model_unavailable") return "The assistant is unavailable right now. Try again in a moment.";
  if (code === "not_found") return "That conversation is no longer available. Start a new one.";
  if (code === "invalid_request") return "That message could not be sent. Try a shorter question.";
  return "Something went wrong while answering. Try again.";
}

export function chatRequestBody(
  message: string,
  conversationId: string | null,
  preferences: readonly string[],
): { message: string; preferences: string[]; conversationId?: string } {
  return {
    message,
    preferences: [...preferences],
    ...(conversationId ? { conversationId } : {}),
  };
}

export function statusPhaseFrom(data: unknown): ChatPhase | null {
  if (!isRecord(data) || !isChatPhase(data.phase)) return null;
  return data.phase;
}

export function messageTextFrom(data: unknown): string | null {
  if (!isRecord(data) || typeof data.text !== "string") return null;
  return data.text;
}

export function errorCodeFrom(data: unknown): string {
  if (!isRecord(data) || typeof data.error !== "string" || !data.error.trim()) return "chat_failed";
  return data.error;
}

export function conversationIdFrom(data: unknown): string | null {
  if (!isRecord(data) || typeof data.conversationId !== "string") return null;
  const id = data.conversationId.trim();
  return id || null;
}

export function suggestionFrom(data: unknown): ApartmentProfile | null {
  return isSuggestionProfile(data) ? data : null;
}

export function isSuggestionProfile(value: unknown): value is ApartmentProfile {
  if (!isRecord(value)) return false;
  return typeof value.placeId === "string" && value.placeId.trim() !== "" && typeof value.name === "string" && value.name.trim() !== "";
}

/** Keep the first three distinct places. A repeat placeId replaces that card. */
export function withSuggestion(
  current: readonly ApartmentProfile[] | undefined,
  profile: ApartmentProfile,
): ApartmentProfile[] {
  const list = current ? [...current] : [];
  const index = list.findIndex((item) => item.placeId === profile.placeId);
  if (index !== -1) {
    list[index] = profile;
    return list;
  }
  if (list.length >= MAX_SUGGESTION_CARDS) return list;
  list.push(profile);
  return list;
}

export function mergeDashboard(
  current: readonly ComparisonApartment[],
  rows: readonly { id: string; profile: ApartmentProfile }[],
): ComparisonApartment[] {
  const saved: ComparisonApartment[] = [];
  for (const row of rows) {
    if (!row || typeof row.id !== "string" || !isSuggestionProfile(row.profile)) continue;
    try {
      saved.push({ ...toComparisonApartment(row.profile), databaseId: row.id });
    } catch {
      // A row the column cannot render stays off the board.
    }
  }
  const active = current.filter((item) => item.researchStatus === "loading" || item.researchStatus === "error");
  return [...saved.filter((item) => !active.some((pending) => pending.id === item.id)), ...active];
}

export function upsertDashboard(
  current: readonly ComparisonApartment[],
  apartment: ComparisonApartment,
): ComparisonApartment[] {
  const index = current.findIndex((item) => item.id === apartment.id);
  if (index === -1) return [apartment, ...current];
  return current.map((item) => (item.id === apartment.id ? apartment : item));
}

export async function readFailureCode(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && typeof body.error === "string" && body.error.trim()) return body.error;
  } catch {
    // The error page was not JSON.
  }
  return response.status === 401 ? "unauthorized" : "chat_failed";
}

export async function readChatStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: ChatStreamEvent) => void,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        const rest = consumeSseBuffer(buffer, onEvent);
        if (rest.trim()) {
          const event = parseSseBlock(rest);
          if (event) onEvent(event);
        }
        return;
      }
      buffer = consumeSseBuffer(buffer + decoder.decode(value, { stream: true }), onEvent);
    }
  } finally {
    reader.releaseLock();
  }
}

function consumeSseBuffer(buffer: string, onEvent: (event: ChatStreamEvent) => void): string {
  const parts = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n\n");
  const rest = parts.pop() ?? "";
  for (const part of parts) {
    const event = parseSseBlock(part);
    if (event) onEvent(event);
  }
  return rest;
}

function parseSseBlock(block: string): ChatStreamEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) event = line.slice("event:".length).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice("data:".length).replace(/^ /, ""));
  }
  if (dataLines.length === 0) return null;
  const raw = dataLines.join("\n");
  try {
    return { event, data: JSON.parse(raw) as unknown };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
