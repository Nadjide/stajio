import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { usersRepository } from "@/src/server/repositories/users";
import { generateId } from "@/src/server/utils";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { email, password, displayName } = await request.json();
  const uid = generateId();
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    usersRepository.create(uid, email, hashedPassword, displayName);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "User already exists" }, { status: 400 });
  }
}
