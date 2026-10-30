import { NextResponse } from "next/server";
import { usersRepository } from "@/src/server/repositories/users";
import { db } from "@/src/server/db";
import { requireAuth } from "@/src/server/route-auth";
import { parseBody, profileSchema } from "@/src/server/validation";
import { getInternshipWeek } from "@/src/utils/internship";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const profile = usersRepository.findProfileByUid(auth.payload.uid);
  return NextResponse.json(profile || null);
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const parsed = await parseBody(request, profileSchema);
  if (parsed.error) return parsed.error;

  db.transaction(() => {
    usersRepository.updateProfile(auth.payload.uid, parsed.data);
    const logs = db.prepare("SELECT id, date FROM logs WHERE uid = ?").all(auth.payload.uid) as Array<{
      id: string;
      date: string;
    }>;
    const update = db.prepare("UPDATE logs SET weekNumber = ? WHERE uid = ? AND id = ?");
    for (const log of logs) {
      update.run(getInternshipWeek(log.date, parsed.data.internshipStart), auth.payload.uid, log.id);
    }
  }).immediate();

  return NextResponse.json({ success: true });
}
