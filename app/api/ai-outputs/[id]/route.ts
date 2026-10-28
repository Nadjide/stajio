import { NextResponse } from "next/server";
import { aiOutputsRepository } from "@/src/server/repositories/ai-outputs";
import { requireAuth } from "@/src/server/route-auth";
import { aiOutputUpdateSchema, parseBody } from "@/src/server/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const parsed = await parseBody(request, aiOutputUpdateSchema);
  if (parsed.error) return parsed.error;
  const output = aiOutputsRepository.update((await params).id, auth.payload.uid, parsed.data);
  return output ? NextResponse.json(output) : NextResponse.json({ error: "Résultat introuvable" }, { status: 404 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  aiOutputsRepository.deleteByIdAndUid(id, auth.payload.uid);
  return NextResponse.json({ success: true });
}
