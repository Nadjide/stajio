import { NextResponse } from "next/server";
import { getAuthFromCookie } from "./auth";

export async function requireAuth() {
  const { payload, hasToken } = await getAuthFromCookie();
  if (!hasToken) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!payload) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { payload };
}
