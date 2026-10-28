type Level = "info" | "warn" | "error";
type Field = string | number | boolean | null | undefined;

/**
 * Structured server diagnostics. Callers pass identifiers, codes and timings
 * only: never passwords, tokens, prompts, notes or generated content.
 */
export function logEvent(level: Level, event: string, fields: Record<string, Field> = {}) {
  if (process.env.VITEST && level !== "error") return;
  const line = JSON.stringify({ at: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function errorName(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}
