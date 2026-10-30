import { NextResponse } from "next/server";
import { z } from "zod";
import { BackupError, MAX_BACKUP_BYTES } from "./schemas";

export const previewRequestSchema = z.object({ backup: z.unknown() }).strict();
export const restoreRequestSchema = z
  .object({
    backup: z.unknown(),
    confirmation: z.literal("REMPLACER"),
    backupHash: z.string().regex(/^[a-f0-9]{64}$/),
    currentHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export async function readBackupRequest<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  if (Number(request.headers.get("content-length")) > MAX_BACKUP_BYTES) {
    throw new BackupError("Le fichier dépasse la limite de 20 Mio.", 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new BackupError("Corps JSON invalide.", 400);
  const chunks: Uint8Array[] = [];
  let total = 0;
  let raw: unknown;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BACKUP_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new BackupError("Le fichier dépasse la limite de 20 Mio.", 413);
      }
      chunks.push(value);
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, total));
    raw = JSON.parse(text);
  } catch (error) {
    if (error instanceof BackupError) throw error;
    throw new BackupError("Corps JSON invalide.", 400);
  } finally {
    reader.releaseLock();
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new BackupError(
      "Requête de restauration invalide. Un aperçu et une confirmation explicite sont nécessaires.",
      400,
      result.error.issues.slice(0, 20).map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`),
    );
  }
  return result.data;
}

export function backupFailure(error: unknown): NextResponse {
  if (error instanceof BackupError) {
    return NextResponse.json(
      { error: error.message, ...(error.details ? { details: error.details } : {}) },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { error: "La restauration a échoué. Tes données n'ont pas été modifiées." },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}
