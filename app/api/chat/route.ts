import { auth } from "@/lib/auth";
import {
  openConversation,
  readChatRequest,
  readMuseConfig,
  runAgentTurn,
} from "@/lib/agent/loop";
import { prisma } from "@/lib/db";

function chatJson(data: unknown, status: number) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return chatJson({ error: "unauthorized" }, 401);

  const body = readChatRequest(await request.json().catch(() => null));
  if (!body.ok) return chatJson({ error: "invalid_request" }, 400);
  if ("error" in readMuseConfig()) return chatJson({ error: "model_unavailable" }, 503);

  try {
    const conversation = await openConversation(userId, body.conversationId);
    if (!conversation) return chatJson({ error: "not_found" }, 404);

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: { text: body.message },
      },
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(sse(event, data)));
        };
        try {
          const result = await runAgentTurn({
            userId,
            message: body.message,
            preferences: body.preferences,
            previousResponseId: conversation.previousResponseId,
            emit(event) {
              if (event.type === "status") send("status", { phase: event.phase });
              else if (event.type === "suggestion") send("suggestion", event.profile);
              else if (event.type === "message") send("message", { text: event.text });
              else send("error", { error: event.error });
            },
          });
          if (result.responseId) {
            await prisma.conversation.updateMany({
              where: { id: conversation.id, userId },
              data: { previousResponseId: result.responseId },
            });
          }
          if (!result.error || result.text || result.suggestions.length) {
            await prisma.message.create({
              data: {
                conversationId: conversation.id,
                role: "assistant",
                content: JSON.parse(JSON.stringify({
                  text: result.text,
                  suggestions: result.suggestions,
                })),
              },
            });
          }
        } catch (error) {
          console.error("[chat]", error instanceof Error ? error.name : "error");
          send("error", { error: "chat_failed" });
        }
        send("done", { conversationId: conversation.id });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    console.error("[chat]", error instanceof Error ? error.name : "error");
    return chatJson({ error: "chat_failed" }, 500);
  }
}
