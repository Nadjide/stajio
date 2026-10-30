import { NextResponse } from "next/server";
import { changeAccountPassword } from "@/src/server/account-service";
import { accountErrorResponse } from "@/src/server/account-http";
import { passwordChangeSchema } from "@/src/server/account-validation";
import { signAuthToken } from "@/src/server/auth";
import { getAuthCookieOptions } from "@/src/server/cookie";
import { requireAuth } from "@/src/server/route-auth";
import { parseBody } from "@/src/server/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const parsed = await parseBody(request, passwordChangeSchema);
  if (parsed.error) return parsed.error;
  try {
    const session = await changeAccountPassword(auth.payload, parsed.data.currentPassword, parsed.data.newPassword);
    const response = NextResponse.json({ success: true });
    response.cookies.set("token", signAuthToken(session, session.authVersion), getAuthCookieOptions());
    return response;
  } catch (error) {
    return accountErrorResponse(error);
  }
}
