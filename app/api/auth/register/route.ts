import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { usersRepository } from "@/src/server/repositories/users";
import { generateId } from "@/src/server/utils";
import { parseBody, registerSchema } from "@/src/server/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await parseBody(request, registerSchema);
  if (parsed.error) return parsed.error;

  const { email, password, displayName } = parsed.data;
  const uid = generateId();
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    usersRepository.create(uid, email, hashedPassword, displayName);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "User already exists" }, { status: 400 });
  }
}
