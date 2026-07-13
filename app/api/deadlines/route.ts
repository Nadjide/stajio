import { NextResponse } from "next/server";
import { deadlinesRepository } from "@/src/server/repositories/deadlines";
import { requireAuth } from "@/src/server/route-auth";
import { generateId } from "@/src/server/utils";
import { deadlineCreateSchema, parseBody } from "@/src/server/validation";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const deadlines = deadlinesRepository.listByUid(auth.payload.uid);
  return NextResponse.json(deadlines);
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const parsed = await parseBody(request, deadlineCreateSchema);
  if (parsed.error) return parsed.error;

  const { id, ...payload } = parsed.data;
  deadlinesRepository.add(id || generateId(), auth.payload.uid, payload);

  return NextResponse.json({ success: true });
}
