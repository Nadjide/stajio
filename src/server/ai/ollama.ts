const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";

type ChatMode = "text" | "json";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type ChatOptions = {
  userPrompt?: string;
  messages?: ChatMessage[];
  systemPrompt?: string;
  mode?: ChatMode;
  temperature?: number;
  model?: string;
};

function buildMessages(options: ChatOptions): ChatMessage[] {
  const { userPrompt, messages, systemPrompt } = options;
  return [
    ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
    ...(messages || []),
    ...(userPrompt ? [{ role: "user" as const, content: userPrompt }] : []),
  ];
}

function buildBody(options: ChatOptions, stream: boolean) {
  const { mode = "text", temperature = 0.2, model } = options;
  return JSON.stringify({
    model: model || OLLAMA_MODEL,
    stream,
    format: mode === "json" ? "json" : undefined,
    options: { temperature },
    messages: buildMessages(options),
  });
}

export async function chatWithOllama(options: ChatOptions) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: buildBody(options, false),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return String(data?.message?.content || "");
}

/**
 * Streams the model response as plain text chunks.
 * Ollama's streaming API returns one JSON object per line.
 */
export async function streamChatWithOllama(options: ChatOptions): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: buildBody(options, true),
  });

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Ollama error (${response.status}): ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffered = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }

      buffered += decoder.decode(value, { stream: true });
      const lines = buffered.split("\n");
      buffered = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          const content = parsed?.message?.content;
          if (content) controller.enqueue(encoder.encode(content));
        } catch {
          // Ligne partielle ou bruit: ignorée
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

export async function listOllamaModels(): Promise<string[]> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
  if (!response.ok) {
    throw new Error(`Ollama error (${response.status})`);
  }
  const data = await response.json();
  const models: Array<{ name?: string }> = Array.isArray(data?.models) ? data.models : [];
  return models.map((m) => String(m.name || "")).filter(Boolean);
}

export function safeJsonParse<T>(value: string): T {
  const cleaned = value.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
  return JSON.parse(cleaned) as T;
}
