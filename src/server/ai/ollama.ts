import type { z } from "zod";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
export const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "phi4-mini";

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Context window requested from Ollama; its own default (2048) silently truncates long journals. */
export const CONTEXT_TOKENS = positiveInteger(process.env.OLLAMA_NUM_CTX, 8192);
/** Room kept for the answer inside the context window. */
export const OUTPUT_RESERVE_TOKENS = Math.min(2048, Math.floor(CONTEXT_TOKENS / 4));
export const INPUT_BUDGET_TOKENS = CONTEXT_TOKENS - OUTPUT_RESERVE_TOKENS;
const REQUEST_TIMEOUT_MS = positiveInteger(process.env.OLLAMA_TIMEOUT_MS, 300_000);

export type AiErrorCode =
  | "unreachable"
  | "model_missing"
  | "model_error"
  | "timeout"
  | "cancelled"
  | "incomplete"
  | "invalid_output"
  | "invalid_input"
  | "context_too_large";

const STATUS_BY_CODE: Record<AiErrorCode, number> = {
  unreachable: 503,
  model_missing: 424,
  model_error: 502,
  timeout: 504,
  cancelled: 499,
  incomplete: 502,
  invalid_output: 502,
  invalid_input: 400,
  context_too_large: 413,
};

export class AiError extends Error {
  readonly status: number;
  constructor(
    readonly code: AiErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AiError";
    this.status = STATUS_BY_CODE[code];
  }
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatOptions = {
  userPrompt?: string;
  messages?: ChatMessage[];
  systemPrompt?: string;
  mode?: "text" | "json";
  temperature?: number;
  model?: string;
};

export function resolveModel(model?: string) {
  return model?.trim() || DEFAULT_MODEL;
}

function buildMessages(options: ChatOptions): ChatMessage[] {
  const { userPrompt, messages, systemPrompt } = options;
  return [
    ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
    ...(messages || []),
    ...(userPrompt ? [{ role: "user" as const, content: userPrompt }] : []),
  ];
}

function buildBody(options: ChatOptions, stream: boolean) {
  const { mode = "text", temperature = 0.2 } = options;
  return JSON.stringify({
    model: resolveModel(options.model),
    stream,
    format: mode === "json" ? "json" : undefined,
    options: { temperature, num_ctx: CONTEXT_TOKENS },
    messages: buildMessages(options),
  });
}

/** Combine the caller's cancellation with the server timeout, keeping track of which fired. */
function withTimeout(signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const abortError = () =>
    timeout.aborted
      ? new AiError(
          "timeout",
          `Le modèle n'a pas répondu dans le délai de ${Math.round(REQUEST_TIMEOUT_MS / 1000)} s. Réduis la sélection ou réessaie.`,
        )
      : new AiError("cancelled", "Génération annulée.");
  return { signal: combined, abortError };
}

async function readOllamaError(response: Response, model: string): Promise<AiError> {
  const text = await response.text().catch(() => "");
  let message = text;
  try {
    message = String(JSON.parse(text)?.error || text);
  } catch {
    // Not JSON: keep the raw text.
  }
  if (response.status === 404 && /not found|pull/i.test(message)) {
    return new AiError("model_missing", `Le modèle « ${model} » n'est pas installé. Lance : ollama pull ${model}`, {
      model,
    });
  }
  return new AiError(
    "model_error",
    `Erreur du modèle (${response.status}) : ${message.slice(0, 300) || "réponse vide"}`,
  );
}

async function postChat(options: ChatOptions, stream: boolean, signal: AbortSignal, abortError: () => AiError) {
  let response: Response;
  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: buildBody(options, stream),
      signal,
    });
  } catch {
    if (signal.aborted) throw abortError();
    throw new AiError("unreachable", "Impossible de contacter Ollama. Vérifie qu'il tourne (ollama serve).");
  }
  if (!response.ok) throw await readOllamaError(response, resolveModel(options.model));
  return response;
}

export async function chatWithOllama(options: ChatOptions, callerSignal?: AbortSignal): Promise<string> {
  const { signal, abortError } = withTimeout(callerSignal);
  const response = await postChat(options, false, signal, abortError);
  let data: { message?: { content?: unknown }; error?: unknown };
  try {
    data = await response.json();
  } catch {
    if (signal.aborted) throw abortError();
    throw new AiError("invalid_output", "Le modèle a renvoyé une réponse illisible. Réessaie.");
  }
  if (data?.error) throw new AiError("model_error", `Erreur du modèle : ${String(data.error).slice(0, 300)}`);
  return String(data?.message?.content || "");
}

type StreamLine = { message?: { content?: unknown }; error?: unknown; done?: unknown };

/**
 * Yields text fragments. Throws an AiError when the model reports an error, the
 * caller cancels, the timeout fires, or the stream ends before Ollama's final line.
 */
export async function* streamChatWithOllama(
  options: ChatOptions,
  callerSignal?: AbortSignal,
): AsyncGenerator<string, void, undefined> {
  const { signal, abortError } = withTimeout(callerSignal);
  const response = await postChat(options, true, signal, abortError);
  if (!response.body) throw new AiError("model_error", "Le modèle n'a renvoyé aucun contenu.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  let finished = false;

  function parse(line: string): string {
    if (!line.trim()) return "";
    let parsed: StreamLine;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new AiError("invalid_output", "Le flux du modèle contient une ligne illisible.");
    }
    if (parsed.error) throw new AiError("model_error", `Erreur du modèle : ${String(parsed.error).slice(0, 300)}`);
    if (parsed.done === true) finished = true;
    const content = parsed.message?.content;
    return typeof content === "string" ? content : "";
  }

  try {
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        if (signal.aborted) throw abortError();
        throw new AiError("incomplete", "La connexion au modèle a été interrompue avant la fin de la réponse.");
      }
      if (chunk.done) break;
      buffered += decoder.decode(chunk.value, { stream: true });
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      for (const line of lines) {
        const text = parse(line);
        if (text) yield text;
      }
    }
    // The final JSON object is not always followed by a newline.
    buffered += decoder.decode();
    const last = parse(buffered);
    if (last) yield last;
    if (!finished) {
      throw new AiError("incomplete", "La réponse du modèle s'est arrêtée avant la fin. Le texte reçu est incomplet.");
    }
  } finally {
    if (!finished) await reader.cancel().catch(() => undefined);
  }
}

export async function listOllamaModels(timeoutMs = 5000): Promise<string[]> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    throw new Error(`Ollama error (${response.status})`);
  }
  const data = await response.json();
  const models: Array<{ name?: string }> = Array.isArray(data?.models) ? data.models : [];
  return models.map((m) => String(m.name || "")).filter(Boolean);
}

export function safeJsonParse<T>(value: string): T {
  const cleaned = value
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "");
  return JSON.parse(cleaned) as T;
}

/** Ask for JSON and accept it only if it matches the task's schema. */
export async function chatJson<S extends z.ZodType>(
  options: Omit<ChatOptions, "mode">,
  schema: S,
  signal?: AbortSignal,
): Promise<z.infer<S>> {
  const text = await chatWithOllama({ ...options, mode: "json" }, signal);
  let raw: unknown;
  try {
    raw = safeJsonParse(text);
  } catch {
    throw new AiError(
      "invalid_output",
      "Le modèle n'a pas renvoyé de JSON valide. Réessaie ou choisis un autre modèle.",
    );
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new AiError(
      "invalid_output",
      "La réponse du modèle ne respecte pas le format attendu. Réessaie ou choisis un autre modèle.",
      {
        issues: parsed.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join(".") || "réponse"}: ${issue.message}`),
      },
    );
  }
  return parsed.data;
}
