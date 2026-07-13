import { NextResponse } from "next/server";
import { deadlinesRepository } from "@/src/server/repositories/deadlines";
import { requireAuth } from "@/src/server/route-auth";
import { deadlineUpdateSchema, parseBody } from "@/src/server/validation";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const parsed = await parseBody(request, deadlineUpdateSchema);
  if (parsed.error) return parsed.error;

  const { id } = await params;
  const updated = deadlinesRepository.updateByIdAndUid(id, auth.payload.uid, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Deadline introuvable" }, { status: 404 });
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
  deadlinesRepository.deleteByIdAndUid(id, auth.payload.uid);
  return NextResponse.json({ success: true });
}
