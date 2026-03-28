import { NextResponse } from "next/server";
import { deadlinesRepository } from "@/src/server/repositories/deadlines";
import { requireAuth } from "@/src/server/route-auth";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const { completed } = await request.json();
  deadlinesRepository.updateCompleted(id, auth.payload.uid, !!completed);
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
