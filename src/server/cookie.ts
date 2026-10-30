import { getSecureAuthCookie } from "./auth-config.mjs";

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: getSecureAuthCookie(),
    sameSite: "lax" as const,
    path: "/",
  };
}
