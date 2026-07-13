import { NextResponse } from "next/server";
import { listOllamaModels } from "@/src/server/ai/ollama";

export const runtime = "nodejs";

export async function GET() {
  try {
    const models = await listOllamaModels();
    return NextResponse.json({ models, default: process.env.OLLAMA_MODEL || "llama3.2" });
  } catch {
    return NextResponse.json(
      { error: "Impossible de contacter Ollama. Vérifie qu'il tourne (ollama serve).", models: [] },
      { status: 503 },
    );
  }
}
