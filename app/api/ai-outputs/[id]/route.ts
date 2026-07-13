import { NextResponse } from "next/server";
import { aiOutputsRepository } from "@/src/server/repositories/ai-outputs";
import { requireAuth } from "@/src/server/route-auth";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  aiOutputsRepository.deleteByIdAndUid(id, auth.payload.uid);
  return NextResponse.json({ success: true });
}
