import { NextResponse } from "next/server";
import { ReportConflictError, reportsRepository } from "@/src/server/repositories/reports";
import { requireAuth } from "@/src/server/route-auth";
import { parseBody, reportRestoreSchema } from "@/src/server/validation";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string; versionId: string }> };
const notFound = () => NextResponse.json({ error: "Version introuvable" }, { status: 404 });

export async function GET(_request: Request, { params }: Context) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { id, versionId } = await params;
  const version = reportsRepository.getVersion(auth.payload.uid, id, versionId);
  return version ? NextResponse.json(version) : notFound();
}

/** Restores a version; the current text is saved as a version first. */
export async function POST(request: Request, { params }: Context) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const parsed = await parseBody(request, reportRestoreSchema);
  if (parsed.error) return parsed.error;
  const { id, versionId } = await params;
  try {
    const report = reportsRepository.restoreVersion(auth.payload.uid, id, versionId, parsed.data.revision);
    return report ? NextResponse.json(report) : notFound();
  } catch (error) {
    if (error instanceof ReportConflictError) {
      return NextResponse.json(
        { error: "Ce rapport a été modifié entre-temps. Recharge-le avant de restaurer.", current: error.current },
        { status: 409 },
      );
    }
    throw error;
  }
}
