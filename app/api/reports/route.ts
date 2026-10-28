import { NextResponse } from "next/server";
import { db } from "@/src/server/db";
import { reportsRepository } from "@/src/server/repositories/reports";
import { usersRepository } from "@/src/server/repositories/users";
import { requireAuth } from "@/src/server/route-auth";
import { generateId } from "@/src/server/utils";
import { parseBody, reportCreateSchema } from "@/src/server/validation";
import { DEFAULT_REPORT_PLAN, emptyBrief } from "@/src/utils/report";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  return NextResponse.json(reportsRepository.list(auth.payload.uid));
}

/** A new report covers the whole internship and every note until the student narrows it. */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const parsed = await parseBody(request, reportCreateSchema);
  if (parsed.error) return parsed.error;
  const { uid } = auth.payload;
  const profile = usersRepository.findProfileByUid(uid);
  const logIds = (
    db.prepare("SELECT id FROM logs WHERE uid = ? ORDER BY date, id").all(uid) as Array<{ id: string }>
  ).map((row) => row.id);
  const report = reportsRepository.create(uid, {
    title: parsed.data.title || "Rapport de stage",
    brief: emptyBrief(profile?.internshipStart || "", profile?.internshipEnd || "", logIds),
    sections: DEFAULT_REPORT_PLAN.map((section) => ({
      id: generateId(),
      ...section,
      content: "",
      generatedAt: null,
      model: null,
    })),
  });
  return NextResponse.json(report, { status: 201 });
}
