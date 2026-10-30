import { NextResponse } from "next/server";
import { conversationsRepository } from "@/src/server/repositories/conversations";
import { requireAuth } from "@/src/server/route-auth";
import { conversationCreateSchema, parseBody } from "@/src/server/validation";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  return NextResponse.json(conversationsRepository.list(auth.payload.uid));
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const parsed = await parseBody(request, conversationCreateSchema);
  if (parsed.error) return parsed.error;
  return NextResponse.json(conversationsRepository.create(auth.payload.uid, parsed.data.title), { status: 201 });
}
