import { NextResponse } from "next/server";
import { listOllamaModels } from "@/src/server/ai/ollama";
import { db } from "@/src/server/db";
import { logEvent } from "@/src/server/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public availability check for Docker, Kubernetes and troubleshooting. It never
 * reveals account data. Ollama is optional: the journal works without it.
 */
export async function GET() {
  let database: "ok" | "error" = "ok";
  try {
    db.prepare("SELECT 1").get();
  } catch {
    database = "error";
    logEvent("error", "health.database_unavailable");
  }
  let ollama: "ok" | "unreachable" = "ok";
  try {
    await listOllamaModels(2000);
  } catch {
    ollama = "unreachable";
  }
  const status = database === "ok" ? (ollama === "ok" ? "ok" : "degraded") : "error";
  return NextResponse.json(
    { status, app: "ok", database, ollama },
    { status: database === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
