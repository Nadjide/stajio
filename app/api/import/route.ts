import { NextResponse } from "next/server";
import { requireAuth } from "@/src/server/route-auth";
import { restoreAccount } from "@/src/server/backup/service";
import { backupFailure, readBackupRequest, restoreRequestSchema } from "@/src/server/backup/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const body = await readBackupRequest(request, restoreRequestSchema);
    const imported = restoreAccount(auth.payload.uid, body.backup, {
      backupHash: body.backupHash,
      currentHash: body.currentHash,
    });
    return NextResponse.json({ success: true, imported }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return backupFailure(error);
  }
}
