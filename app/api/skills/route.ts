import { NextResponse } from "next/server";
import { SkillError, skillsRepository } from "@/src/server/repositories/skills";
import { requireAuth } from "@/src/server/route-auth";
import { parseBody, skillCreateSchema } from "@/src/server/validation";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  return NextResponse.json(skillsRepository.list(auth.payload.uid));
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const parsed = await parseBody(request, skillCreateSchema);
  if (parsed.error) return parsed.error;
  try {
    return NextResponse.json(skillsRepository.create(auth.payload.uid, parsed.data), { status: 201 });
  } catch (error) {
    if (error instanceof SkillError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
