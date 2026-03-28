import { NextResponse } from "next/server";
import { chatWithOllama, safeJsonParse } from "@/src/server/ai/ollama";

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

export async function POST(request: Request) {
  try {
    const { task, payload } = await request.json();

    if (task === "structureLog") {
      const text = await chatWithOllama({
        mode: "json",
        userPrompt: `Structure cette entrée de journal d'alternance. Réponds uniquement en JSON valide avec ce schéma exact: {"summary":string,"missions":string[],"technologies":string[],"skills":string[]}. Entrée: ${payload?.rawContent || ""}`,
      });
      return NextResponse.json(safeJsonParse<StructureLogResult>(text));
    }

    if (task === "generateReport") {
      const text = await chatWithOllama({
        userPrompt: `Génère un rapport de stage structuré en français, format Markdown. Contexte étudiant: ${JSON.stringify(payload?.userData || {})}. Logs: ${JSON.stringify(payload?.logs || [])}. Inclure: Introduction, Présentation de l'entreprise, Missions réalisées, Bilan technique, Conclusion.`,
      });
      return NextResponse.json({ content: text });
    }

    if (task === "prepareDefense") {
      const text = await chatWithOllama({
        mode: "json",
        userPrompt: `Prépare une soutenance en français. Réponds uniquement en JSON valide avec ce schéma exact: {"plan":string[],"questions":[{"question":string,"answerHint":string}]}. Contexte étudiant: ${JSON.stringify(payload?.userData || {})}. Expérience: ${JSON.stringify(payload?.logs || [])}.`,
      });
      return NextResponse.json(safeJsonParse<PrepareDefenseResult>(text));
    }

    if (task === "generateCVPoints") {
      const text = await chatWithOllama({
        userPrompt: `Transforme ces expériences d'alternance en bullet points optimisés ATS, en français. Utilise des verbes d'action et quantifie les résultats si possible. Données: ${JSON.stringify(payload?.logs || [])}`,
      });
      return NextResponse.json({ content: text });
    }

    return NextResponse.json({ error: "Unsupported AI task" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
