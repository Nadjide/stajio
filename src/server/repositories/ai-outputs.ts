import { db } from "../db";

type AiOutputRow = {
  id: string;
  uid: string;
  type: string;
  title: string;
  content: string;
  createdAt: string;
};

export const aiOutputsRepository = {
  listByUid: (uid: string) => {
    return db
      .prepare("SELECT * FROM ai_outputs WHERE uid = ? ORDER BY createdAt DESC")
      .all(uid) as AiOutputRow[];
  },

  add: (
    id: string,
    uid: string,
    payload: { type: string; title: string; content: string; createdAt?: string },
  ) => {
    const stmt = db.prepare(`
      INSERT INTO ai_outputs (id, uid, type, title, content, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, uid, payload.type, payload.title, payload.content, payload.createdAt || new Date().toISOString());
  },

  deleteByIdAndUid: (id: string, uid: string) => {
    const stmt = db.prepare("DELETE FROM ai_outputs WHERE id = ? AND uid = ?");
    stmt.run(id, uid);
  },
};
