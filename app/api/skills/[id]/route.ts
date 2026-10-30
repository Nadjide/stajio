import { NextResponse } from "next/server";
import { SkillError, skillsRepository } from "@/src/server/repositories/skills";
import { requireAuth } from "@/src/server/route-auth";
import { parseBody, skillUpdateSchema } from "@/src/server/validation";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const parsed = await parseBody(request, skillUpdateSchema);
  if (parsed.error) return parsed.error;
  try {
    const skill = skillsRepository.update(auth.payload.uid, (await params).id, parsed.data);
    return skill ? NextResponse.json(skill) : NextResponse.json({ error: "Compétence introuvable" }, { status: 404 });
  } catch (error) {
    if (error instanceof SkillError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  skillsRepository.delete(auth.payload.uid, (await params).id);
  return NextResponse.json({ success: true });
}
