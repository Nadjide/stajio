import { NextResponse } from "next/server";
import { logsRepository } from "@/src/server/repositories/logs";
import { usersRepository } from "@/src/server/repositories/users";
import { db } from "@/src/server/db";
import { requireAuth } from "@/src/server/route-auth";
import { logUpdateSchema, parseBody } from "@/src/server/validation";
import { getInternshipWeek, isCalendarDate } from "@/src/utils/internship";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const parsed = await parseBody(request, logUpdateSchema);
  if (parsed.error) return parsed.error;

  const { id } = await params;
  return db
    .transaction(() => {
      const existing = db.prepare("SELECT date FROM logs WHERE id = ? AND uid = ?").get(id, auth.payload.uid) as
        | { date: string }
        | undefined;
      if (!existing) return NextResponse.json({ error: "Entrée introuvable" }, { status: 404 });
      const profile = usersRepository.findProfileByUid(auth.payload.uid);
      if (!isCalendarDate(profile?.internshipStart)) {
        return NextResponse.json(
          { error: "Configure une date de début de stage valide avant de modifier une entrée." },
          { status: 409 },
        );
      }
      logsRepository.updateByIdAndUid(id, auth.payload.uid, {
        ...parsed.data,
        weekNumber: getInternshipWeek(parsed.data.date ?? existing.date, profile.internshipStart),
      });
      return NextResponse.json({ success: true });
    })
    .immediate();
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  logsRepository.deleteByIdAndUid(id, auth.payload.uid);
  return NextResponse.json({ success: true });
}
