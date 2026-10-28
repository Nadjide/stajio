import { NextResponse } from "next/server";
import { deleteAccountData } from "@/src/server/account-service";
import { accountErrorResponse } from "@/src/server/account-http";
import { accountDeleteSchema } from "@/src/server/account-validation";
import { signAuthToken } from "@/src/server/auth";
import { getAuthCookieOptions } from "@/src/server/cookie";
import { requireAuth } from "@/src/server/route-auth";
import { parseBody } from "@/src/server/validation";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const parsed = await parseBody(request, accountDeleteSchema);
  if (parsed.error) return parsed.error;
  try {
    const { scope } = parsed.data;
    const session = await deleteAccountData(auth.payload, parsed.data.currentPassword, scope);
    const response = NextResponse.json({ success: true, scope });
    if (session) {
      response.cookies.set("token", signAuthToken(session, session.authVersion), getAuthCookieOptions());
    } else {
      response.cookies.set("token", "", { ...getAuthCookieOptions(), expires: new Date(0) });
    }
    return response;
  } catch (error) {
    return accountErrorResponse(error);
  }
}
