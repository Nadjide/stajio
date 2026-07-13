import { NextResponse } from "next/server";
import { aiOutputsRepository } from "@/src/server/repositories/ai-outputs";
import { requireAuth } from "@/src/server/route-auth";
import { generateId } from "@/src/server/utils";
import { aiOutputCreateSchema, parseBody } from "@/src/server/validation";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const outputs = aiOutputsRepository.listByUid(auth.payload.uid);
  return NextResponse.json(outputs);
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const parsed = await parseBody(request, aiOutputCreateSchema);
  if (parsed.error) return parsed.error;

  const id = generateId();
  aiOutputsRepository.add(id, auth.payload.uid, parsed.data);
  return NextResponse.json({ success: true, id });
}
