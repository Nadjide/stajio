import { NextResponse } from "next/server";
import { chatWithOllama, safeJsonParse } from "@/src/server/ai/ollama";
import {
  structureLogPrompt,
  generateReportPrompt,
  prepareDefensePrompt,
  generateCVPointsPrompt,
  chatSystemPrompt,
  evaluateAnswerPrompt,
  sanitizeChatHistory,
} from "@/src/server/ai/prompts";
import { aiRequestSchema, parseBody } from "@/src/server/validation";

export const runtime = "nodejs";

type StructureLogResult = {
  summary: string;
  missions: string[];
  technologies: string[];
  skills: string[];
};

type PrepareDefenseResult = {
  plan: string[];
  questions: Array<{ question: string; answerHint: string }>;
};

type EvaluateAnswerResult = {
  score: number;
  feedback: string;
  improvedAnswer: string;
};

export async function POST(request: Request) {
  const parsed = await parseBody(request, aiRequestSchema);
  if (parsed.error) return parsed.error;
  const { task, payload, model } = parsed.data;

  try {
    if (task === "structureLog") {
      const text = await chatWithOllama({
        mode: "json",
        model,
        userPrompt: structureLogPrompt(payload),
      });
      return NextResponse.json(safeJsonParse<StructureLogResult>(text));
    }

    if (task === "generateReport") {
      const text = await chatWithOllama({ model, userPrompt: generateReportPrompt(payload) });
      return NextResponse.json({ content: text });
    }

    if (task === "prepareDefense") {
      const text = await chatWithOllama({
        mode: "json",
        model,
        userPrompt: prepareDefensePrompt(payload),
      });
      return NextResponse.json(safeJsonParse<PrepareDefenseResult>(text));
    }

    if (task === "generateCVPoints") {
      const text = await chatWithOllama({ model, userPrompt: generateCVPointsPrompt(payload) });
      return NextResponse.json({ content: text });
    }

    if (task === "chat") {
      const text = await chatWithOllama({
        model,
        systemPrompt: chatSystemPrompt(payload),
        messages: sanitizeChatHistory(payload),
        userPrompt: String(payload?.message || ""),
        temperature: 0.5,
      });
      return NextResponse.json({ content: text });
    }

    if (task === "evaluateAnswer") {
      const text = await chatWithOllama({
        mode: "json",
        model,
        userPrompt: evaluateAnswerPrompt(payload),
      });
      return NextResponse.json(safeJsonParse<EvaluateAnswerResult>(text));
    }

    return NextResponse.json({ error: "Unsupported AI task" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI processing failed";
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
