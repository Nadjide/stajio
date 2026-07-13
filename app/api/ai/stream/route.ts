import { NextResponse } from "next/server";
import { streamChatWithOllama } from "@/src/server/ai/ollama";
import {
  generateReportPrompt,
  generateCVPointsPrompt,
  chatSystemPrompt,
  sanitizeChatHistory,
} from "@/src/server/ai/prompts";
import { aiStreamRequestSchema, parseBody } from "@/src/server/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await parseBody(request, aiStreamRequestSchema);
  if (parsed.error) return parsed.error;
  const { task, payload, model } = parsed.data;

  try {
    let stream: ReadableStream<Uint8Array>;

    if (task === "generateReport") {
      stream = await streamChatWithOllama({ model, userPrompt: generateReportPrompt(payload) });
    } else if (task === "generateCVPoints") {
      stream = await streamChatWithOllama({ model, userPrompt: generateCVPointsPrompt(payload) });
    } else {
      stream = await streamChatWithOllama({
        model,
        systemPrompt: chatSystemPrompt(payload),
        messages: sanitizeChatHistory(payload),
        userPrompt: String(payload?.message || ""),
        temperature: 0.5,
      });
    }

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI streaming failed";
    const isConnectionError = /fetch failed|ECONNREFUSED/i.test(message);
    return NextResponse.json(
      {
        error: isConnectionError
          ? "Impossible de contacter Ollama. Vérifie qu'il tourne (ollama serve)."
          : message,
      },
      { status: isConnectionError ? 503 : 500 },
    );
  }
}
