import { NextResponse } from "next/server";
import { AccountError } from "./account-credentials.mjs";

export function accountErrorResponse(error: unknown) {
  if (error instanceof AccountError) return NextResponse.json({ error: error.message }, { status: error.status });
  return NextResponse.json(
    {
      error:
        "L'opération n'a pas pu être confirmée. Reconnecte-toi et vérifie l'état de tes données avant de réessayer.",
    },
    { status: 500 },
  );
}
