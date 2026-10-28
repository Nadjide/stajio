import { NextResponse } from "next/server";
import { assertWithinBudget, loadProfile, loadSources } from "@/src/server/ai/context";
import { aiErrorResponse, eventStream } from "@/src/server/ai/http";
import { resolveModel, streamChatWithOllama, type ChatMessage } from "@/src/server/ai/ollama";
import { chatSystemPrompt } from "@/src/server/ai/prompts";
import { db } from "@/src/server/db";
import { conversationsRepository, DEFAULT_CONVERSATION_TITLE } from "@/src/server/repositories/conversations";
import { requireAuth } from "@/src/server/route-auth";
import { conversationMessageSchema, parseBody } from "@/src/server/validation";

export const runtime = "nodejs";

const HISTORY_LIMIT = 20;

/**
 * Sends a message (or retries the last unanswered one) and streams the reply.
 * The server stores both sides: a reload or a second tab never loses an
 * exchange, and an interrupted reply is kept and marked as such.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const parsed = await parseBody(request, conversationMessageSchema);
  if (parsed.error) return parsed.error;
  const { uid } = auth.payload;
  const { id } = await params;
  const body = parsed.data;
  const model = resolveModel(body.model);

  const prepared = db
    .transaction(() => {
      const conversation = conversationsRepository.get(uid, id);
      if (!conversation) return { error: NextResponse.json({ error: "Conversation introuvable" }, { status: 404 }) };
      let messages = conversation.messages ?? [];
      if (body.retry) {
        // Drop the interrupted reply so the retry does not duplicate it.
        const last = messages.at(-1);
        if (last?.role === "assistant" && last.status !== "complete") {
          conversationsRepository.deleteMessage(uid, last.id);
          messages = messages.slice(0, -1);
        }
        if (messages.at(-1)?.role !== "user") {
          return {
            error: NextResponse.json({ error: "Aucun message sans réponse à relancer." }, { status: 409 }),
          };
        }
      } else if (body.clientMessageId && conversationsRepository.hasMessage(uid, body.clientMessageId)) {
        // A resent request: answer only if the stored message is still unanswered.
        if (messages.at(-1)?.id !== body.clientMessageId) {
          return {
            error: NextResponse.json(
              { error: "Ce message a déjà été envoyé. La conversation a été actualisée." },
              { status: 409 },
            ),
          };
        }
      } else {
        const message = conversationsRepository.addMessage(uid, id, {
          id: body.clientMessageId,
          role: "user",
          content: body.content!,
          status: "complete",
        });
        messages = [...messages, message];
        if (conversation.title === DEFAULT_CONVERSATION_TITLE) {
          const title = body.content!.replace(/\s+/g, " ").trim().slice(0, 60);
          conversationsRepository.rename(uid, id, title || DEFAULT_CONVERSATION_TITLE);
        }
      }
      return { messages };
    })
    .immediate();
  if ("error" in prepared) return prepared.error;

  let systemPrompt: string;
  let history: ChatMessage[];
  try {
    const sources = loadSources(uid);
    systemPrompt = chatSystemPrompt(loadProfile(uid), sources);
    // Only complete exchanges are context; an interrupted fragment is not.
    history = prepared.messages
      .filter((message) => message.status === "complete")
      .slice(-HISTORY_LIMIT)
      .map((message) => ({ role: message.role, content: message.content }));
    assertWithinBudget([systemPrompt, ...history.map((message) => message.content)], sources.length);
  } catch (error) {
    return aiErrorResponse(error, "chat");
  }

  return eventStream("chat", request.signal, async (send, signal) => {
    send({ type: "meta", model });
    let reply = "";
    try {
      for await (const text of streamChatWithOllama(
        { model, systemPrompt, messages: history, temperature: 0.5 },
        signal,
      )) {
        reply += text;
        send({ type: "delta", text });
      }
    } catch (error) {
      if (reply.trim()) {
        const message = conversationsRepository.addMessage(uid, id, {
          role: "assistant",
          content: reply,
          status: "interrupted",
          model,
        });
        send({ type: "meta", model, interruptedMessage: message });
      }
      throw error;
    }
    const message = conversationsRepository.addMessage(uid, id, {
      role: "assistant",
      content: reply,
      status: "complete",
      model,
    });
    send({ type: "done", message });
  });
}
