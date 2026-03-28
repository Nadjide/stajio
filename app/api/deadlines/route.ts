import { NextResponse } from "next/server";
import { deadlinesRepository } from "@/src/server/repositories/deadlines";
import { requireAuth } from "@/src/server/route-auth";
import { generateId } from "@/src/server/utils";

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

  const { id, title, date, type, completed } = await request.json();
  deadlinesRepository.add(id || generateId(), auth.payload.uid, {
    title,
    date,
    type,
    completed,
  });

  return NextResponse.json({ success: true });
}
