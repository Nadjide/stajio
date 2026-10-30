import { db } from "../db";
import { nowIso, parseJson } from "../utils";
import type { SourceSnapshot } from "../../types/models";

type AiOutputRow = {
  id: string;
  uid: string;
  type: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string | null;
  model: string | null;
  instructions: string | null;
  sources: string | null;
};

function toOutput(row: AiOutputRow) {
  return { ...row, sources: parseJson<SourceSnapshot[]>(row.sources, []) };
}

export const aiOutputsRepository = {
  listByUid: (uid: string) => {
    const rows = db.prepare("SELECT * FROM ai_outputs WHERE uid = ? ORDER BY createdAt DESC").all(uid) as AiOutputRow[];
    return rows.map(toOutput);
  },

  get: (id: string, uid: string) => {
    const row = db.prepare("SELECT * FROM ai_outputs WHERE id = ? AND uid = ?").get(id, uid) as AiOutputRow | undefined;
    return row ? toOutput(row) : null;
  },

  add: (
    id: string,
    uid: string,
    payload: {
      type: string;
      title: string;
      content: string;
      createdAt?: string;
      model?: string | null;
      instructions?: string | null;
      sources?: SourceSnapshot[] | null;
    },
  ) => {
    const stmt = db.prepare(`
      INSERT INTO ai_outputs (id, uid, type, title, content, createdAt, updatedAt, model, instructions, sources)
      VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
    `);
    stmt.run(
      id,
      uid,
      payload.type,
      payload.title,
      payload.content,
      payload.createdAt || nowIso(),
      payload.model ?? null,
      payload.instructions ?? null,
      payload.sources ? JSON.stringify(payload.sources) : null,
    );
  },

  /** Student corrections replace the text; the generation's provenance is kept. */
  update: (id: string, uid: string, payload: { title?: string; content?: string }) => {
    const existing = aiOutputsRepository.get(id, uid);
    if (!existing) return null;
    db.prepare("UPDATE ai_outputs SET title = ?, content = ?, updatedAt = ? WHERE id = ? AND uid = ?").run(
      payload.title ?? existing.title,
      payload.content ?? existing.content,
      nowIso(),
      id,
      uid,
    );
    return aiOutputsRepository.get(id, uid);
  },

  deleteByIdAndUid: (id: string, uid: string) => {
    const stmt = db.prepare("DELETE FROM ai_outputs WHERE id = ? AND uid = ?");
    stmt.run(id, uid);
  },
};
