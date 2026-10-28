import { NextResponse } from "next/server";
import { conversationsRepository } from "@/src/server/repositories/conversations";
import { requireAuth } from "@/src/server/route-auth";
import { conversationRenameSchema, parseBody } from "@/src/server/validation";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };
const notFound = () => NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });

export async function GET(_request: Request, { params }: Context) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const conversation = conversationsRepository.get(auth.payload.uid, (await params).id);
  return conversation ? NextResponse.json(conversation, { headers: { "Cache-Control": "no-store" } }) : notFound();
}

export async function PATCH(request: Request, { params }: Context) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const parsed = await parseBody(request, conversationRenameSchema);
  if (parsed.error) return parsed.error;
  const { id } = await params;
  if (!conversationsRepository.rename(auth.payload.uid, id, parsed.data.title)) return notFound();
  return NextResponse.json(conversationsRepository.get(auth.payload.uid, id));
}

export async function DELETE(_request: Request, { params }: Context) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  conversationsRepository.delete(auth.payload.uid, (await params).id);
  return NextResponse.json({ success: true });
}
