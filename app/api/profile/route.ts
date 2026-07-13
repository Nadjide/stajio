import { NextResponse } from "next/server";
import { usersRepository } from "@/src/server/repositories/users";
import { requireAuth } from "@/src/server/route-auth";
import { parseBody, profileSchema } from "@/src/server/validation";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const profile = usersRepository.findProfileByUid(auth.payload.uid);
  return NextResponse.json(profile || null);
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const parsed = await parseBody(request, profileSchema);
  if (parsed.error) return parsed.error;

  usersRepository.updateProfile(auth.payload.uid, parsed.data);

  return NextResponse.json({ success: true });
}
