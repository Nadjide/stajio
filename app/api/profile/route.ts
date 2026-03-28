import { NextResponse } from "next/server";
import { usersRepository } from "@/src/server/repositories/users";
import { requireAuth } from "@/src/server/route-auth";

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

  const { school, degree, internshipStart, internshipEnd, company, tutorName, displayName } = await request.json();
  usersRepository.updateProfile(auth.payload.uid, {
    school,
    degree,
    internshipStart,
    internshipEnd,
    company,
    tutorName,
    displayName,
  });

  return NextResponse.json({ success: true });
}
