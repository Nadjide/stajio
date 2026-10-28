import { NextResponse } from "next/server";
import { loadProfile, loadSources, measurePrompt } from "@/src/server/ai/context";
import { aiErrorResponse } from "@/src/server/ai/http";
import { AiError } from "@/src/server/ai/ollama";
import { chatSystemPrompt, cvPointsPrompt, defensePrepPrompt, reportSectionPrompt } from "@/src/server/ai/prompts";
import { aiEstimateSchema } from "@/src/server/ai/schemas";
import { reportsRepository } from "@/src/server/repositories/reports";
import { requireAuth } from "@/src/server/route-auth";
import { parseBody } from "@/src/server/validation";

export const runtime = "nodejs";

/** Preview of the prompt size, measured with the exact text the generation would send. */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const parsed = await parseBody(request, aiEstimateSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;
  const { uid } = auth.payload;
  try {
    const profile = loadProfile(uid);
    let prompt: string;
    let noteCount: number;
    if (body.task === "report") {
      const report = reportsRepository.get(uid, body.reportId);
      if (!report) throw new AiError("invalid_input", "Ce rapport n'existe plus.");
      const sources = loadSources(uid, body.logIds ?? report.brief.sourceLogIds);
      const brief = { ...report.brief, sourceLogIds: sources.map((source) => source.id) };
      // The largest section prompt bounds every per-section generation.
      const section = report.sections.reduce(
        (largest, item) => (item.intent.length > largest.intent.length ? item : largest),
        report.sections[0] ?? { id: "", title: "", intent: "", content: "", generatedAt: null, model: null },
      );
      prompt = reportSectionPrompt(profile, brief, report.sections, section, sources);
      noteCount = sources.length;
    } else if (body.task === "chat") {
      const sources = loadSources(uid);
      prompt = chatSystemPrompt(profile, sources);
      noteCount = sources.length;
    } else {
      const sources = loadSources(uid, body.logIds);
      prompt = body.task === "cv" ? cvPointsPrompt(profile, sources) : defensePrepPrompt(profile, sources);
      noteCount = sources.length;
    }
    return NextResponse.json({ ...measurePrompt([prompt]), noteCount });
  } catch (error) {
    return aiErrorResponse(error, `estimate.${body.task}`);
  }
}
