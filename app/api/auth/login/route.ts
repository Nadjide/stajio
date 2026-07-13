import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { signAuthToken } from "@/src/server/auth";
import { getAuthCookieOptions } from "@/src/server/cookie";
import { usersRepository } from "@/src/server/repositories/users";
import { loginSchema, parseBody } from "@/src/server/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await parseBody(request, loginSchema);
  if (parsed.error) return parsed.error;

  const { email, password } = parsed.data;
  const user = usersRepository.findByEmail(email);

  if (user && (await bcrypt.compare(password, user.password))) {
    const token = signAuthToken({ uid: user.uid, email: user.email });
    const response = NextResponse.json({
      user: { uid: user.uid, email: user.email, displayName: user.displayName },
    });
    response.cookies.set("token", token, getAuthCookieOptions());
    return response;
  }

  return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
}
