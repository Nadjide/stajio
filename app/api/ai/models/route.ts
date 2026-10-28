import { NextResponse } from "next/server";
import { listOllamaModels } from "@/src/server/ai/ollama";
import { requireAuth } from "@/src/server/route-auth";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  try {
    const models = await listOllamaModels();
    return NextResponse.json({ models, default: process.env.OLLAMA_MODEL || "phi4-mini" });
  } catch {
    return NextResponse.json(
      { error: "Impossible de contacter Ollama. Vérifie qu'il tourne (ollama serve).", models: [] },
      { status: 503 },
    );
  }
}
