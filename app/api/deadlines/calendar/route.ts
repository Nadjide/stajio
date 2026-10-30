import { deadlinesRepository } from "@/src/server/repositories/deadlines";
import { requireAuth } from "@/src/server/route-auth";
import type { Deadline } from "@/src/types/models";
import { deadlinesToIcs } from "@/src/utils/calendar";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const deadlines = deadlinesRepository.listByUid(auth.payload.uid) as Deadline[];
  return new Response(deadlinesToIcs(deadlines), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="stajio-echeances.ics"',
      "Cache-Control": "no-store",
    },
  });
}
