import { NextResponse } from "next/server";
import { getAuthFromCookie } from "@/src/server/auth";
import { usersRepository } from "@/src/server/repositories/users";

export const runtime = "nodejs";

export async function GET() {
  const { payload } = await getAuthFromCookie();
  if (!payload) {
    return NextResponse.json({ user: null });
  }

  const user = usersRepository.findPublicByUid(payload.uid);
  return NextResponse.json({ user: user || null });
}
