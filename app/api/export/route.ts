import { NextResponse } from "next/server";
import { requireAuth } from "@/src/server/route-auth";
import { exportAccount } from "@/src/server/backup/service";
import { BackupError } from "@/src/server/backup/schemas";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const backup = exportAccount(auth.payload.uid);
    return new NextResponse(JSON.stringify(backup), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="stajio-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof BackupError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: "Impossible de créer la sauvegarde. Tes données n'ont pas été modifiées." },
      { status: 500 },
    );
  }
}
