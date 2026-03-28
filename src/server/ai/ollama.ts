const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";

type ChatMode = "text" | "json";

export async function chatWithOllama(options: {
  userPrompt: string;
  systemPrompt?: string;
  mode?: ChatMode;
  temperature?: number;
}) {
  const { userPrompt, systemPrompt, mode = "text", temperature = 0.2 } = options;

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format: mode === "json" ? "json" : undefined,
      options: {
        temperature,
      },
      messages: [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return String(data?.message?.content || "");
}

export function safeJsonParse<T>(value: string): T {
  const cleaned = value.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
  return JSON.parse(cleaned) as T;
}
