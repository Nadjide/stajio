import { assertWithinBudget, loadProfile, loadSources } from "@/src/server/ai/context";
import { aiErrorResponse, eventStream } from "@/src/server/ai/http";
import { AiError, resolveModel, streamChatWithOllama } from "@/src/server/ai/ollama";
import { cvPointsPrompt, PROMPT_VERSION, reportSectionPrompt } from "@/src/server/ai/prompts";
import { aiStreamRequestSchema } from "@/src/server/ai/schemas";
import { reportsRepository } from "@/src/server/repositories/reports";
import { requireAuth } from "@/src/server/route-auth";
import { parseBody } from "@/src/server/validation";

export const runtime = "nodejs";

function preparePrompt(uid: string, body: ReturnType<typeof aiStreamRequestSchema.parse>) {
  const profile = loadProfile(uid);
  if (body.task === "generateCVPoints") {
    const sources = loadSources(uid, body.payload.logIds);
    return { prompt: cvPointsPrompt(profile, sources), sources };
  }
  const report = reportsRepository.get(uid, body.payload.reportId);
  const section = report?.sections.find((item) => item.id === body.payload.sectionId);
  if (!report || !section) throw new AiError("invalid_input", "Cette section n'existe plus. Recharge le rapport.");
  const sources = loadSources(uid, report.brief.sourceLogIds);
  return { prompt: reportSectionPrompt(profile, report.brief, report.sections, section, sources), sources };
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const parsed = await parseBody(request, aiStreamRequestSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;
  const model = resolveModel(body.model);

  // Input problems are reported as HTTP errors before the stream starts.
  let prepared: ReturnType<typeof preparePrompt>;
  try {
    prepared = preparePrompt(auth.payload.uid, body);
    assertWithinBudget([prepared.prompt], prepared.sources.length);
  } catch (error) {
    return aiErrorResponse(error, body.task);
  }

  return eventStream(body.task, request.signal, async (send, signal) => {
    send({
      type: "meta",
      model,
      generatedAt: new Date().toISOString(),
      instructions: PROMPT_VERSION,
      sources: prepared.sources,
    });
    for await (const text of streamChatWithOllama({ model, userPrompt: prepared.prompt }, signal)) {
      send({ type: "delta", text });
    }
    send({ type: "done" });
  });
}
