import { NextResponse } from "next/server";
import { assertWithinBudget, loadProfile, loadSources } from "@/src/server/ai/context";
import { aiErrorResponse } from "@/src/server/ai/http";
import { AiError, chatJson, resolveModel } from "@/src/server/ai/ollama";
import { defensePrepPrompt, PROMPT_VERSION, reportPlanPrompt, structureLogPrompt } from "@/src/server/ai/prompts";
import { aiRequestSchema, defensePrepOutput, reportPlanOutput, structureLogOutput } from "@/src/server/ai/schemas";
import { reportsRepository } from "@/src/server/repositories/reports";
import { requireAuth } from "@/src/server/route-auth";
import { parseBody } from "@/src/server/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const parsed = await parseBody(request, aiRequestSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;
  const { uid } = auth.payload;
  const model = resolveModel(body.model);
  const generatedAt = new Date().toISOString();

  try {
    if (body.task === "structureLog") {
      const prompt = structureLogPrompt(body.payload.rawContent);
      assertWithinBudget([prompt], 1);
      const result = await chatJson({ model, userPrompt: prompt }, structureLogOutput, request.signal);
      return NextResponse.json({ result, model, generatedAt });
    }

    if (body.task === "prepareDefense") {
      const profile = loadProfile(uid);
      const sources = loadSources(uid, body.payload.logIds);
      const prompt = defensePrepPrompt(profile, sources);
      assertWithinBudget([prompt], sources.length);
      const result = await chatJson({ model, userPrompt: prompt }, defensePrepOutput, request.signal);
      return NextResponse.json({ result, model, generatedAt, sources, instructions: PROMPT_VERSION });
    }

    const report = reportsRepository.get(uid, body.payload.reportId);
    if (!report) throw new AiError("invalid_input", "Ce rapport n'existe plus.");
    const profile = loadProfile(uid);
    const sources = loadSources(uid, report.brief.sourceLogIds);
    const prompt = reportPlanPrompt(profile, report.brief, sources);
    assertWithinBudget([prompt], sources.length);
    const result = await chatJson({ model, userPrompt: prompt }, reportPlanOutput, request.signal);
    return NextResponse.json({ result, model, generatedAt, sources, instructions: PROMPT_VERSION });
  } catch (error) {
    return aiErrorResponse(error, body.task);
  }
}
