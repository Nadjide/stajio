import { NextResponse } from "next/server";
import { reportsRepository } from "@/src/server/repositories/reports";
import { requireAuth } from "@/src/server/route-auth";
import { parseBody, reportVersionCreateSchema } from "@/src/server/validation";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!reportsRepository.get(auth.payload.uid, id)) {
    return NextResponse.json({ error: "Rapport introuvable" }, { status: 404 });
  }
  return NextResponse.json(reportsRepository.listVersions(auth.payload.uid, id));
}

export async function POST(request: Request, { params }: Context) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const parsed = await parseBody(request, reportVersionCreateSchema);
  if (parsed.error) return parsed.error;
  const version = reportsRepository.createVersion(auth.payload.uid, (await params).id, parsed.data.label);
  return version
    ? NextResponse.json(version, { status: 201 })
    : NextResponse.json({ error: "Rapport introuvable" }, { status: 404 });
}
