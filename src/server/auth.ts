import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "stajio-secret-key-change-me";

export type AuthPayload = {
  uid: string;
  email: string;
};

export function signAuthToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyAuthToken(token: string): AuthPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    return decoded;
  } catch {
    return null;
  }
}

export async function getAuthFromCookie(): Promise<{ payload: AuthPayload | null; hasToken: boolean }> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return { payload: null, hasToken: false };
  return { payload: verifyAuthToken(token), hasToken: true };
}
