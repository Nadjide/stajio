import { NextResponse } from "next/server";
import { logsRepository } from "@/src/server/repositories/logs";
import { requireAuth } from "@/src/server/route-auth";
import { logUpdateSchema, parseBody } from "@/src/server/validation";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const parsed = await parseBody(request, logUpdateSchema);
  if (parsed.error) return parsed.error;

  const { id } = await params;
  const updated = logsRepository.updateByIdAndUid(id, auth.payload.uid, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Entrée introuvable" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  logsRepository.deleteByIdAndUid(id, auth.payload.uid);
  return NextResponse.json({ success: true });
}
