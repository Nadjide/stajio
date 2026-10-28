import { db } from "./db";

/** Every table holding an account's business data, children before parents. */
export const ACCOUNT_CONTENT_TABLES = [
  "skill_evidence",
  "skills",
  "report_versions",
  "reports",
  "conversation_messages",
  "conversations",
  "simulations",
  "drafts",
  "logs",
  "deadlines",
  "ai_outputs",
] as const;

/** Call inside a transaction; the profile and credentials are handled by the caller. */
export function deleteAccountContent(uid: string) {
  for (const table of ACCOUNT_CONTENT_TABLES) {
    db.prepare(`DELETE FROM ${table} WHERE uid = ?`).run(uid);
  }
}
