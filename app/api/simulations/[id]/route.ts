import { NextResponse } from "next/server";
import { simulationsRepository } from "@/src/server/repositories/simulations";
import { requireAuth } from "@/src/server/route-auth";
import { parseBody, simulationUpdateSchema } from "@/src/server/validation";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };
const notFound = () => NextResponse.json({ error: "Simulation introuvable" }, { status: 404 });

export async function GET(_request: Request, { params }: Context) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const simulation = simulationsRepository.get(auth.payload.uid, (await params).id);
  return simulation ? NextResponse.json(simulation, { headers: { "Cache-Control": "no-store" } }) : notFound();
}

export async function PATCH(request: Request, { params }: Context) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const parsed = await parseBody(request, simulationUpdateSchema);
  if (parsed.error) return parsed.error;
  const simulation = simulationsRepository.update(auth.payload.uid, (await params).id, parsed.data);
  return simulation ? NextResponse.json(simulation) : notFound();
}

export async function DELETE(_request: Request, { params }: Context) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  simulationsRepository.delete(auth.payload.uid, (await params).id);
  return NextResponse.json({ success: true });
}
