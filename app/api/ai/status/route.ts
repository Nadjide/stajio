import { NextResponse } from "next/server";
import { CONTEXT_TOKENS, DEFAULT_MODEL, INPUT_BUDGET_TOKENS, listOllamaModels } from "@/src/server/ai/ollama";
import { requireAuth } from "@/src/server/route-auth";
import type { AiStatus } from "@/src/types/models";

export const runtime = "nodejs";

/** Diagnostic shown to the student: is Ollama reachable, and which models are installed. */
export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  let models: string[] = [];
  let reachable = true;
  try {
    models = await listOllamaModels(3000);
  } catch {
    reachable = false;
  }
  const status: AiStatus = {
    reachable,
    defaultModel: DEFAULT_MODEL,
    models,
    contextTokens: CONTEXT_TOKENS,
    inputBudgetTokens: INPUT_BUDGET_TOKENS,
  };
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}
