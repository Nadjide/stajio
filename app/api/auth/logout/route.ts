import { NextResponse } from "next/server";
import { getAuthCookieOptions } from "@/src/server/cookie";

export const runtime = "nodejs";

export function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("token", "", {
    ...getAuthCookieOptions(),
    expires: new Date(0),
  });
  return response;
}
