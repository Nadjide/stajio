import { db } from "../db";
import { nowIso } from "../utils";

export type DraftRow = { key: string; content: string; updatedAt: string };

export const draftsRepository = {
  get: (uid: string, key: string) => {
    return db.prepare("SELECT key, content, updatedAt FROM drafts WHERE uid = ? AND key = ?").get(uid, key) as
      | DraftRow
      | undefined;
  },

  save: (uid: string, key: string, content: string) => {
    const updatedAt = nowIso();
    db.prepare(
      `INSERT INTO drafts (uid, key, content, updatedAt) VALUES (?, ?, ?, ?)
      ON CONFLICT(uid, key) DO UPDATE SET content = excluded.content, updatedAt = excluded.updatedAt`,
    ).run(uid, key, content, updatedAt);
    return { key, content, updatedAt };
  },

  delete: (uid: string, key: string) => {
    db.prepare("DELETE FROM drafts WHERE uid = ? AND key = ?").run(uid, key);
  },
};
