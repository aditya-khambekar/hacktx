import "server-only";

import OpenAI from "openai";
import type { ApartmentProfile } from "../profile";
import { prisma } from "../db";
import { withSerpBudget } from "../serpapi";
import { loadMemoryBrief } from "./memory";
import { agentInstructions } from "./prompt";
import { agentTools, createToolSession, type ChatPhase } from "./tools";

export const MAX_MODEL_TURNS = 8;
export const MUSE_BASE_URL = "https://api.meta.ai/v1";
const MAX_MESSAGE_LENGTH = 4000;
const MAX_PREFERENCES = 24;

const ALLOWED_MODELS = new Set(["muse-spark-1.3", "muse-wonder-1.0"]);

export type AgentEvent =
  | { type: "status"; phase: ChatPhase }
  | { type: "suggestion"; profile: ApartmentProfile }
  | { type: "message"; text: string }
  | { type: "error"; error: string };

export type AgentTurnResult = {
  responseId: string | null;
  text: string;
  suggestions: ApartmentProfile[];
  error?: string;
};

export type ChatRequest =
  | {
      ok: true;
      message: string;
      conversationId?: string;
      preferences?: unknown;
    }
  | { ok: false };

type ConversationTurn = {
  id: string;
  previousResponseId: string | null;
};

export function readMuseConfig(): { model: string } | { error: "model_unavailable" } {
  const model = process.env.MUSE_MODEL ?? "muse-spark-1.3";
  if (!process.env.MODEL_API_KEY || !ALLOWED_MODELS.has(model)) {
    return { error: "model_unavailable" };
  }
  return { model };
}

export function readChatRequest(value: unknown): ChatRequest {
  if (!isRecord(value)) return { ok: false };
  if (
    Object.keys(value).some(
      (key) => key !== "message" && key !== "conversationId" && key !== "preferences",
    )
  ) {
    return { ok: false };
  }
  if (typeof value.message !== "string") return { ok: false };
  const message = value.message.trim();
  if (!message || message.length > MAX_MESSAGE_LENGTH) return { ok: false };

  let conversationId: string | undefined;
  if (value.conversationId !== undefined) {
    if (typeof value.conversationId !== "string") return { ok: false };
    const id = value.conversationId.trim();
    if (!id || id.length > 128) return { ok: false };
    conversationId = id;
  }
  if (value.preferences !== undefined) {
    if (
      !Array.isArray(value.preferences) ||
      value.preferences.length > MAX_PREFERENCES ||
      value.preferences.some((item) => typeof item !== "string")
    ) {
      return { ok: false };
    }
  }

  return {
    ok: true,
    message,
    ...(conversationId ? { conversationId } : {}),
    ...(value.preferences !== undefined ? { preferences: value.preferences } : {}),
  };
}

/** Load a conversation only when it belongs to this user. Omit the id to start a new one. */
export async function openConversation(
  userId: string,
  conversationId?: string,
): Promise<ConversationTurn | null> {
  if (!userId) return null;
  if (conversationId) {
    return prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true, previousResponseId: true },
    });
  }
  return prisma.conversation.create({
    data: { userId },
    select: { id: true, previousResponseId: true },
  });
}

export async function runAgentTurn(input: {
  userId: string;
  message: string;
  preferences?: unknown;
  previousResponseId: string | null;
  emit: (event: AgentEvent) => void;
}): Promise<AgentTurnResult> {
  const config = readMuseConfig();
  if ("error" in config) {
    input.emit({ type: "error", error: config.error });
    return { responseId: null, text: "", suggestions: [], error: config.error };
  }
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) {
    input.emit({ type: "error", error: "model_unavailable" });
    return { responseId: null, text: "", suggestions: [], error: "model_unavailable" };
  }

  const client = new OpenAI({ baseURL: MUSE_BASE_URL, apiKey });
  const session = createToolSession(input.userId, {
    status: (phase) => input.emit({ type: "status", phase }),
    suggestion: (profile) => input.emit({ type: "suggestion", profile }),
  });

  try {
    return await withSerpBudget(() =>
      runTurns(client, config.model, input, session),
    );
  } catch (error) {
    console.error("[chat]", {
      name: error instanceof Error ? error.name : "Error",
      status: isRecord(error) && typeof error.status === "number" ? error.status : undefined,
    });
    input.emit({ type: "error", error: "chat_failed" });
    return {
      responseId: null,
      text: "",
      suggestions: [...session.suggestions],
      error: "chat_failed",
    };
  }
}

async function runTurns(
  client: OpenAI,
  model: string,
  input: {
    userId: string;
    message: string;
    preferences?: unknown;
    previousResponseId: string | null;
    emit: (event: AgentEvent) => void;
  },
  session: ReturnType<typeof createToolSession>,
): Promise<AgentTurnResult> {
  let previousId = input.previousResponseId;
  let modelInput: OpenAI.Responses.ResponseCreateParams["input"] = input.message;

  for (let turn = 0; turn < MAX_MODEL_TURNS; turn += 1) {
    // Instructions are not stored on the previous response, so the board is loaded again.
    const instructions = agentInstructions(
      await loadMemoryBrief(input.userId, input.preferences),
    );
    const response = await client.responses.create({
      model,
      instructions,
      tools: agentTools,
      tool_choice: "auto",
      input: modelInput,
      ...(previousId ? { previous_response_id: previousId } : {}),
    });
    const calls = functionCalls(response.output);
    if (calls.length === 0) {
      const text = response.output_text ?? "";
      input.emit({ type: "message", text });
      return {
        responseId: response.id,
        text,
        suggestions: [...session.suggestions],
      };
    }

    const outputs: OpenAI.Responses.ResponseInputItem[] = [];
    for (const call of calls) {
      const result = await session.execute(call.name, call.arguments);
      outputs.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(result ?? null),
      });
    }
    if (turn === MAX_MODEL_TURNS - 1) {
      const text = response.output_text?.trim()
        ? response.output_text
        : "I stopped before finishing that search. Ask again and I will use the apartments already saved on your board.";
      input.emit({ type: "message", text });
      // Leave previousResponseId unchanged. This response is still waiting on tool output.
      return { responseId: null, text, suggestions: [...session.suggestions] };
    }
    previousId = response.id;
    modelInput = outputs;
  }

  return { responseId: null, text: "", suggestions: [...session.suggestions] };
}

function functionCalls(
  output: OpenAI.Responses.Response["output"] | undefined,
): OpenAI.Responses.ResponseFunctionToolCall[] {
  return (output ?? []).filter(
    (item): item is OpenAI.Responses.ResponseFunctionToolCall => item.type === "function_call",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
