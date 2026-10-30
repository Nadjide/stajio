import { NextResponse } from "next/server";
import { assertWithinBudget, loadProfile } from "@/src/server/ai/context";
import { aiErrorResponse } from "@/src/server/ai/http";
import { chatJson, resolveModel } from "@/src/server/ai/ollama";
import { evaluateAnswerPrompt } from "@/src/server/ai/prompts";
import { evaluationOutput } from "@/src/server/ai/schemas";
import { simulationsRepository } from "@/src/server/repositories/simulations";
import { requireAuth } from "@/src/server/route-auth";
import { parseBody, simulationAnswerSchema } from "@/src/server/validation";
import type { DefenseEvaluation } from "@/src/types/models";

export const runtime = "nodejs";

/** The answer is stored before evaluation, so a model failure never loses it. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const parsed = await parseBody(request, simulationAnswerSchema);
  if (parsed.error) return parsed.error;
  const { uid } = auth.payload;
  const { id } = await params;
  const { index, answer } = parsed.data;
  const simulation = simulationsRepository.get(uid, id);
  if (!simulation) return NextResponse.json({ error: "Simulation introuvable" }, { status: 404 });
  const step = simulation.steps[index];
  if (!step) return NextResponse.json({ error: "Question introuvable" }, { status: 404 });

  const withAnswer = simulation.steps.map((item, position) =>
    position === index ? { ...item, answer, evaluation: null } : item,
  );
  simulationsRepository.update(uid, id, { steps: withAnswer, currentStep: index });

  try {
    const prompt = evaluateAnswerPrompt(loadProfile(uid), step.question, answer);
    assertWithinBudget([prompt], 0);
    const evaluation = (await chatJson(
      { model: resolveModel(parsed.data.model), userPrompt: prompt },
      evaluationOutput,
      request.signal,
    )) as DefenseEvaluation;
    const updated = simulationsRepository.update(uid, id, {
      steps: withAnswer.map((item, position) => (position === index ? { ...item, evaluation } : item)),
    });
    return NextResponse.json(updated);
  } catch (error) {
    return aiErrorResponse(error, "simulation.evaluate");
  }
}
