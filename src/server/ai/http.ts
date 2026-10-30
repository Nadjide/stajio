import { NextResponse } from "next/server";
import { errorName, logEvent } from "../log";
import { AiError } from "./ollama";

export function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  return new AiError("model_error", "Le traitement IA a échoué. Réessaie dans un instant.");
}

export function aiErrorResponse(error: unknown, task: string) {
  const aiError = toAiError(error);
  logEvent(aiError.code === "cancelled" ? "info" : "warn", "ai.failed", {
    task,
    code: aiError.code,
    cause: error instanceof AiError ? undefined : errorName(error),
  });
  return NextResponse.json(
    { error: aiError.message, code: aiError.code, ...(aiError.details ? { details: aiError.details } : {}) },
    { status: aiError.status },
  );
}

export type StreamEvent =
  | { type: "meta"; model: string; [key: string]: unknown }
  | { type: "delta"; text: string }
  | { type: "done"; [key: string]: unknown }
  | { type: "error"; code: string; message: string; [key: string]: unknown };

/**
 * Newline-delimited JSON events. Unlike a plain text stream, a model error or an
 * interruption reaches the client as an explicit event instead of a truncated text.
 * The producer receives a signal aborted when the client disconnects or cancels.
 */
export function eventStream(
  task: string,
  requestSignal: AbortSignal,
  producer: (send: (event: StreamEvent) => void, signal: AbortSignal) => Promise<void>,
) {
  const encoder = new TextEncoder();
  const cancelled = new AbortController();
  const signal = AbortSignal.any([requestSignal, cancelled.signal]);
  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: StreamEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false;
        }
      };
      try {
        await producer(send, signal);
        logEvent("info", "ai.stream.completed", { task, ms: Date.now() - startedAt });
      } catch (error) {
        const aiError = toAiError(
          signal.aborted && !(error instanceof AiError) ? new AiError("cancelled", "Génération annulée.") : error,
        );
        logEvent(aiError.code === "cancelled" ? "info" : "warn", "ai.stream.failed", {
          task,
          code: aiError.code,
          ms: Date.now() - startedAt,
        });
        send({ type: "error", code: aiError.code, message: aiError.message, ...(aiError.details ?? {}) });
      } finally {
        open = false;
        try {
          controller.close();
        } catch {
          // Already closed by a client cancellation.
        }
      }
    },
    cancel() {
      cancelled.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
