import { NextResponse } from "next/server";
import { assertWithinBudget, loadProfile, loadSources } from "@/src/server/ai/context";
import { aiErrorResponse } from "@/src/server/ai/http";
import { AiError, chatJson, resolveModel } from "@/src/server/ai/ollama";
import { defensePrepPrompt } from "@/src/server/ai/prompts";
import { defensePrepOutput } from "@/src/server/ai/schemas";
import { simulationsRepository } from "@/src/server/repositories/simulations";
import { requireAuth } from "@/src/server/route-auth";
import { parseBody, simulationCreateSchema } from "@/src/server/validation";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  return NextResponse.json(simulationsRepository.list(auth.payload.uid));
}

/** Generates the jury questions and stores the session before the first answer. */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const parsed = await parseBody(request, simulationCreateSchema);
  if (parsed.error) return parsed.error;
  const { uid } = auth.payload;
  const model = resolveModel(parsed.data.model);
  try {
    const sources = loadSources(uid, parsed.data.logIds);
    if (!sources.length) {
      throw new AiError("invalid_input", "Ajoute d'abord des notes de journal : le jury se base dessus.");
    }
    const prompt = defensePrepPrompt(loadProfile(uid), sources);
    assertWithinBudget([prompt], sources.length);
    const prep = await chatJson({ model, userPrompt: prompt }, defensePrepOutput, request.signal);
    const generatedAt = new Date().toISOString();
    const simulation = simulationsRepository.create(uid, {
      title: `Simulation du ${new Date().toLocaleDateString("fr-FR")}`,
      steps: prep.questions.map((question) => ({ ...question, answer: null, evaluation: null })),
      context: { model, generatedAt, sources },
    });
    return NextResponse.json(simulation, { status: 201 });
  } catch (error) {
    return aiErrorResponse(error, "simulation.create");
  }
}
