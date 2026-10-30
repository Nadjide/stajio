import { NextResponse } from "next/server";
import { requireAuth } from "@/src/server/route-auth";
import { previewRestore } from "@/src/server/backup/service";
import { backupFailure, previewRequestSchema, readBackupRequest } from "@/src/server/backup/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  try {
    const { backup } = await readBackupRequest(request, previewRequestSchema);
    return NextResponse.json(
      { preview: previewRestore(auth.payload.uid, backup) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return backupFailure(error);
  }
}
