import { NextResponse } from "next/server";
import { logsRepository } from "@/src/server/repositories/logs";
import { usersRepository } from "@/src/server/repositories/users";
import { db } from "@/src/server/db";
import { requireAuth } from "@/src/server/route-auth";
import { generateId } from "@/src/server/utils";
import { logCreateSchema, parseBody } from "@/src/server/validation";
import { getInternshipWeek, isCalendarDate } from "@/src/utils/internship";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const profile = usersRepository.findProfileByUid(auth.payload.uid);
  const logs = logsRepository.listByUid(auth.payload.uid).map((log) => ({
    ...log,
    weekNumber: getInternshipWeek(log.date, profile?.internshipStart),
  }));
  return NextResponse.json(logs);
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const parsed = await parseBody(request, logCreateSchema);
  if (parsed.error) return parsed.error;

  return db
    .transaction(() => {
      const profile = usersRepository.findProfileByUid(auth.payload.uid);
      if (!isCalendarDate(profile?.internshipStart)) {
        return NextResponse.json(
          { error: "Configure une date de début de stage valide avant d'ajouter une entrée." },
          { status: 409 },
        );
      }
      const { id: requestedId, ...payload } = parsed.data;
      const id = requestedId || generateId();
      logsRepository.add(id, auth.payload.uid, {
        ...payload,
        weekNumber: getInternshipWeek(payload.date, profile.internshipStart),
      });
      return NextResponse.json({ success: true, id });
    })
    .immediate();
}
