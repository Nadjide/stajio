import type { ChatMessage, DefenseEvaluation, DefensePrep } from "../types/models";

const MODEL_STORAGE_KEY = "stajio-model";

export function getPreferredModel(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return localStorage.getItem(MODEL_STORAGE_KEY) || undefined;
}

export function setPreferredModel(model: string | null) {
  if (typeof window === "undefined") return;
  if (model) {
    localStorage.setItem(MODEL_STORAGE_KEY, model);
  } else {
    localStorage.removeItem(MODEL_STORAGE_KEY);
  }
}

const callLocalAi = async <T = unknown>(task: string, payload: Record<string, unknown>) => {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task, payload, model: getPreferredModel() }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || "Erreur IA locale");
  }

  return data as T;
};

/**
 * Appelle une tâche IA en streaming: onChunk reçoit le texte cumulé à chaque token.
 * Retourne le texte complet à la fin.
 */
export async function streamLocalAi(
  task: "generateReport" | "generateCVPoints" | "chat",
  payload: Record<string, unknown>,
  onChunk: (fullText: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch("/api/ai/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task, payload, model: getPreferredModel() }),
    signal,
  });

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || "Erreur IA locale");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    fullText += decoder.decode(value, { stream: true });
    onChunk(fullText);
  }

  return fullText;
}

export const structureLog = async (rawContent: string) => {
  return callLocalAi<{
    summary: string;
    missions: string[];
    technologies: string[];
    skills: string[];
  }>("structureLog", { rawContent });
};

export const generateReport = (
  userData: unknown,
  logs: unknown[],
  onChunk: (text: string) => void,
) => streamLocalAi("generateReport", { userData, logs }, onChunk);

export const generateCVPoints = (logs: unknown[], onChunk: (text: string) => void) =>
  streamLocalAi("generateCVPoints", { logs }, onChunk);

export const prepareDefense = async (userData: unknown, logs: unknown[]) => {
  return callLocalAi<DefensePrep>("prepareDefense", { userData, logs });
};

export const chatWithAssistant = (
  payload: { userData: unknown; logs: unknown[]; history: ChatMessage[]; message: string },
  onChunk: (text: string) => void,
  signal?: AbortSignal,
) => streamLocalAi("chat", payload, onChunk, signal);

export const evaluateDefenseAnswer = async (payload: {
  userData: unknown;
  question: string;
  answer: string;
}) => {
  return callLocalAi<DefenseEvaluation>("evaluateAnswer", payload);
};
