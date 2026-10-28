import { NextResponse } from "next/server";
import { draftKeySchema } from "@/src/server/content-schemas";
import { draftsRepository } from "@/src/server/repositories/drafts";
import { requireAuth } from "@/src/server/route-auth";
import { draftSaveSchema, parseBody } from "@/src/server/validation";

export const runtime = "nodejs";

type Context = { params: Promise<{ key: string }> };

async function readKey(context: Context) {
  const parsed = draftKeySchema.safeParse((await context.params).key);
  return parsed.success ? parsed.data : null;
}

const invalidKey = () => NextResponse.json({ error: "Clé de brouillon invalide" }, { status: 400 });
const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET(_request: Request, context: Context) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const key = await readKey(context);
  if (!key) return invalidKey();
  return NextResponse.json({ draft: draftsRepository.get(auth.payload.uid, key) ?? null }, noStore);
}

export async function PUT(request: Request, context: Context) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const key = await readKey(context);
  if (!key) return invalidKey();
  const parsed = await parseBody(request, draftSaveSchema);
  if (parsed.error) return parsed.error;
  return NextResponse.json({ draft: draftsRepository.save(auth.payload.uid, key, parsed.data.content) }, noStore);
}

export async function DELETE(_request: Request, context: Context) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const key = await readKey(context);
  if (!key) return invalidKey();
  draftsRepository.delete(auth.payload.uid, key);
  return NextResponse.json({ success: true });
}
