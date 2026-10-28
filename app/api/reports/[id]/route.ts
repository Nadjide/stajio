import { NextResponse } from "next/server";
import { ReportConflictError, reportsRepository } from "@/src/server/repositories/reports";
import { requireAuth } from "@/src/server/route-auth";
import { parseBody, reportUpdateSchema } from "@/src/server/validation";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };
const notFound = () => NextResponse.json({ error: "Rapport introuvable" }, { status: 404 });

export async function GET(_request: Request, { params }: Context) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const report = reportsRepository.get(auth.payload.uid, (await params).id);
  return report ? NextResponse.json(report, { headers: { "Cache-Control": "no-store" } }) : notFound();
}

export async function PUT(request: Request, { params }: Context) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const parsed = await parseBody(request, reportUpdateSchema);
  if (parsed.error) return parsed.error;
  const { revision, ...payload } = parsed.data;
  try {
    const report = reportsRepository.update(
      auth.payload.uid,
      (await params).id,
      revision,
      payload as Parameters<typeof reportsRepository.update>[3],
    );
    return report ? NextResponse.json(report) : notFound();
  } catch (error) {
    if (error instanceof ReportConflictError) {
      return NextResponse.json(
        {
          error: "Ce rapport a été modifié dans un autre onglet. Recharge-le avant de continuer.",
          current: error.current,
        },
        { status: 409 },
      );
    }
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  reportsRepository.delete(auth.payload.uid, (await params).id);
  return NextResponse.json({ success: true });
}
