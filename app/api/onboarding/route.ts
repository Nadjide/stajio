import { NextResponse } from "next/server";
import { db } from "@/src/server/db";
import { deadlinesRepository } from "@/src/server/repositories/deadlines";
import { draftsRepository } from "@/src/server/repositories/drafts";
import { usersRepository } from "@/src/server/repositories/users";
import { requireAuth } from "@/src/server/route-auth";
import { generateId } from "@/src/server/utils";
import { onboardingSchema, parseBody } from "@/src/server/validation";
import { getInternshipWeek } from "@/src/utils/internship";
import { isProfileComplete } from "@/src/utils/profile";

export const runtime = "nodejs";

/**
 * Saves the profile and the confirmed initial deadlines together, so an
 * interruption never leaves a configured profile without its chosen deadlines,
 * and a repeated submission cannot duplicate them.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const parsed = await parseBody(request, onboardingSchema);
  if (parsed.error) return parsed.error;
  const { uid } = auth.payload;

  return db
    .transaction(() => {
      if (isProfileComplete(usersRepository.findProfileByUid(uid))) {
        return NextResponse.json(
          { error: "Ton profil est déjà configuré. Recharge la page pour accéder au tableau de bord." },
          { status: 409 },
        );
      }
      const { profile, deadlines } = parsed.data;
      usersRepository.updateProfile(uid, profile);
      const logs = db.prepare("SELECT id, date FROM logs WHERE uid = ?").all(uid) as Array<{
        id: string;
        date: string;
      }>;
      const updateWeek = db.prepare("UPDATE logs SET weekNumber = ? WHERE uid = ? AND id = ?");
      for (const log of logs) updateWeek.run(getInternshipWeek(log.date, profile.internshipStart), uid, log.id);
      for (const deadline of deadlines) {
        deadlinesRepository.add(generateId(), uid, { ...deadline, completed: false });
      }
      draftsRepository.delete(uid, "onboarding");
      return NextResponse.json({ success: true, deadlines: deadlines.length });
    })
    .immediate();
}
