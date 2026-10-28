import { NextResponse } from "next/server";
import { SkillError, skillsRepository } from "@/src/server/repositories/skills";
import { requireAuth } from "@/src/server/route-auth";
import { parseBody, skillMergeSchema } from "@/src/server/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const parsed = await parseBody(request, skillMergeSchema);
  if (parsed.error) return parsed.error;
  try {
    const skill = skillsRepository.merge(auth.payload.uid, parsed.data.sourceId, parsed.data.targetId);
    return skill ? NextResponse.json(skill) : NextResponse.json({ error: "Compétence introuvable" }, { status: 404 });
  } catch (error) {
    if (error instanceof SkillError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
