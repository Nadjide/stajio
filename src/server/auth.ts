import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { getJwtSecret } from "./auth-config.mjs";
import { db } from "./db";
import { AccountError } from "./account-credentials.mjs";

export type AuthPayload = {
  uid: string;
  email: string;
  authVersion: number;
};

export function signAuthToken(payload: Pick<AuthPayload, "uid" | "email">, expectedAuthVersion?: number): string {
  const user = db.prepare("SELECT uid, email, authVersion FROM users WHERE uid = ?").get(payload.uid) as
    | AuthPayload
    | undefined;
  if (!user) throw new Error("Impossible d'ouvrir une session pour un compte inexistant.");
  if (expectedAuthVersion !== undefined && user.authVersion !== expectedAuthVersion) {
    throw new AccountError("La session a changé. Reconnecte-toi avec ton mot de passe actuel.", 409);
  }
  return jwt.sign(user, getJwtSecret(), { algorithm: "HS256", expiresIn: "7d" });
}

export function verifyAuthToken(token: string): AuthPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
    if (typeof decoded !== "object" || !decoded) return null;
    const { uid, email, exp } = decoded;
    // Sessions issued before the authVersion migration are version zero.
    const authVersion = decoded.authVersion ?? 0;
    if (
      typeof uid !== "string" ||
      !uid ||
      typeof email !== "string" ||
      !email ||
      typeof exp !== "number" ||
      !Number.isInteger(authVersion) ||
      authVersion < 0
    )
      return null;
    const user = db.prepare("SELECT email, authVersion FROM users WHERE uid = ?").get(uid) as
      | Pick<AuthPayload, "email" | "authVersion">
      | undefined;
    if (!user || user.email !== email || user.authVersion !== authVersion) return null;
    return { uid, email, authVersion };
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
