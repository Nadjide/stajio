import { NextResponse } from "next/server";
import { logsRepository } from "@/src/server/repositories/logs";
import { requireAuth } from "@/src/server/route-auth";
import { generateId } from "@/src/server/utils";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const logs = logsRepository.listByUid(auth.payload.uid);
  return NextResponse.json(logs);
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const { id, date, rawContent, structuredContent, skills, weekNumber, summary, missions, technologies } = await request.json();

  logsRepository.add(id || generateId(), auth.payload.uid, {
    date,
    rawContent,
    structuredContent,
    skills,
    weekNumber,
    summary,
    missions,
    technologies,
  });

  return NextResponse.json({ success: true });
}
