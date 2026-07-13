import { NextResponse } from "next/server";
import { aiOutputsRepository } from "@/src/server/repositories/ai-outputs";
import { deadlinesRepository } from "@/src/server/repositories/deadlines";
import { logsRepository } from "@/src/server/repositories/logs";
import { usersRepository } from "@/src/server/repositories/users";
import { requireAuth } from "@/src/server/route-auth";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const uid = auth.payload.uid;
  const data = {
    exportedAt: new Date().toISOString(),
    version: 1,
    profile: usersRepository.findProfileByUid(uid) || null,
    logs: logsRepository.listByUid(uid),
    deadlines: deadlinesRepository.listByUid(uid),
    aiOutputs: aiOutputsRepository.listByUid(uid),
  };

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="stajio-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
