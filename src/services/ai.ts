import type { ConversationMessage, DefensePrep, SourceSnapshot } from "../types/models";

const MODEL_STORAGE_KEY = "stajio-model";

export function getPreferredModel(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return localStorage.getItem(MODEL_STORAGE_KEY) || undefined;
  } catch {
    return undefined;
  }
}

export function setPreferredModel(model: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (model) localStorage.setItem(MODEL_STORAGE_KEY, model);
    else localStorage.removeItem(MODEL_STORAGE_KEY);
  } catch {
    // Storage unavailable: the server default model is used.
  }
}

/** An AI failure with whatever text arrived before it, so nothing already received is lost. */
export class AiRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly partial = "",
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AiRequestError";
  }

  get cancelled() {
    return this.code === "cancelled";
  }
}

function cancelledError(partial = "") {
  return new AiRequestError(
    partial ? "Génération arrêtée. Le texte reçu est incomplet." : "Génération annulée.",
    "cancelled",
    partial,
  );
}

async function failure(response: Response): Promise<AiRequestError> {
  const data = await response.json().catch(() => null);
  return new AiRequestError(
    data?.error || "Erreur de l'IA locale.",
    data?.code || `http_${response.status}`,
    "",
    data?.details,
  );
}

export type GenerationMeta = {
  model: string;
  generatedAt?: string;
  instructions?: string;
  sources?: SourceSnapshot[];
  interruptedMessage?: ConversationMessage;
};

type StreamHandlers = {
  onText?: (fullText: string) => void;
  onMeta?: (meta: GenerationMeta) => void;
  signal?: AbortSignal;
};

export type StreamResult = { text: string; meta: GenerationMeta | null; done: Record<string, unknown> };

/** Reads the server's newline-delimited events; only a final "done" event means the text is complete. */
async function readEventStream(response: Response, { onText, onMeta, signal }: StreamHandlers): Promise<StreamResult> {
  if (!response.body) throw new AiRequestError("Le serveur n'a renvoyé aucun contenu.", "incomplete");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  let text = "";
  let meta: GenerationMeta | null = null;
  let done: Record<string, unknown> | null = null;

  const handle = (line: string) => {
    if (!line.trim()) return;
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(line);
    } catch {
      throw new AiRequestError("Le flux reçu est illisible.", "invalid_output", text);
    }
    if (event.type === "delta" && typeof event.text === "string") {
      text += event.text;
      onText?.(text);
    } else if (event.type === "meta") {
      meta = { ...(meta ?? {}), ...(event as GenerationMeta) };
      onMeta?.(meta);
    } else if (event.type === "error") {
      const { type: _type, code, message, ...details } = event;
      throw new AiRequestError(
        String(message || "Erreur de l'IA locale."),
        String(code || "model_error"),
        text,
        details,
      );
    } else if (event.type === "done") {
      done = event;
    }
  };

  try {
    for (;;) {
      const { done: finished, value } = await reader.read();
      if (finished) break;
      buffered += decoder.decode(value, { stream: true });
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      lines.forEach(handle);
    }
    buffered += decoder.decode();
    handle(buffered);
  } catch (error) {
    if (error instanceof AiRequestError) throw error;
    if (signal?.aborted) throw cancelledError(text);
    throw new AiRequestError("La connexion a été interrompue avant la fin de la réponse.", "incomplete", text);
  }
  if (!done) {
    if (signal?.aborted) throw cancelledError(text);
    throw new AiRequestError("La réponse s'est arrêtée avant la fin. Le texte reçu est incomplet.", "incomplete", text);
  }
  return { text, meta, done };
}

async function postStream(url: string, body: unknown, handlers: StreamHandlers) {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: handlers.signal,
    });
  } catch {
    if (handlers.signal?.aborted) throw cancelledError();
    throw new AiRequestError("Le serveur Stajio est injoignable.", "network");
  }
  if (!response.ok) throw await failure(response);
  return readEventStream(response, handlers);
}

type AiResponse<T> = {
  result: T;
  model: string;
  generatedAt: string;
  sources?: SourceSnapshot[];
  instructions?: string;
};

async function callLocalAi<T>(task: string, payload: Record<string, unknown>, signal?: AbortSignal) {
  let response: Response;
  try {
    response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, payload, model: getPreferredModel() }),
      signal,
    });
  } catch {
    if (signal?.aborted) throw cancelledError();
    throw new AiRequestError("Le serveur Stajio est injoignable.", "network");
  }
  if (!response.ok) throw await failure(response);
  return (await response.json()) as AiResponse<T>;
}

export type StructuredLog = { summary: string; missions: string[]; technologies: string[]; skills: string[] };

export const structureLog = (rawContent: string, signal?: AbortSignal) =>
  callLocalAi<StructuredLog>("structureLog", { rawContent }, signal);

export const prepareDefense = (logIds: string[] | undefined, signal?: AbortSignal) =>
  callLocalAi<DefensePrep>("prepareDefense", logIds ? { logIds } : {}, signal);

export const proposeReportPlan = (reportId: string, signal?: AbortSignal) =>
  callLocalAi<{ sections: Array<{ title: string; intent: string }> }>("reportPlan", { reportId }, signal);

export const generateCVPoints = (logIds: string[], handlers: StreamHandlers) =>
  postStream("/api/ai/stream", { task: "generateCVPoints", payload: { logIds }, model: getPreferredModel() }, handlers);

export const generateReportSection = (reportId: string, sectionId: string, handlers: StreamHandlers) =>
  postStream(
    "/api/ai/stream",
    { task: "reportSection", payload: { reportId, sectionId }, model: getPreferredModel() },
    handlers,
  );

export const sendChatMessage = (
  conversationId: string,
  message: { content: string; clientMessageId: string } | { retry: true },
  handlers: StreamHandlers,
) => postStream(`/api/conversations/${conversationId}/messages`, { ...message, model: getPreferredModel() }, handlers);
