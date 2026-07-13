import { NextResponse } from "next/server";
import { deadlinesRepository } from "@/src/server/repositories/deadlines";
import { logsRepository } from "@/src/server/repositories/logs";
import { aiOutputsRepository } from "@/src/server/repositories/ai-outputs";
import { requireAuth } from "@/src/server/route-auth";
import { generateId } from "@/src/server/utils";
import { importSchema, parseBody } from "@/src/server/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const parsed = await parseBody(request, importSchema);
  if (parsed.error) return parsed.error;

  const uid = auth.payload.uid;
  let imported = { logs: 0, deadlines: 0, aiOutputs: 0 };

  for (const log of parsed.data.logs) {
    logsRepository.add(generateId(), uid, log);
    imported.logs += 1;
  }
  for (const deadline of parsed.data.deadlines) {
    deadlinesRepository.add(generateId(), uid, deadline);
    imported.deadlines += 1;
  }
  for (const output of parsed.data.aiOutputs) {
    aiOutputsRepository.add(generateId(), uid, output);
    imported.aiOutputs += 1;
  }

  return NextResponse.json({ success: true, imported });
}
