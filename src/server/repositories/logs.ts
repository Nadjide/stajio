import { db } from "../db";
import { parseJsonArray } from "../utils";

type LogRow = {
  id: string;
  uid: string;
  date: string;
  rawContent: string;
  structuredContent: string;
  skills: string;
  weekNumber: number;
  summary?: string;
  missions?: string;
  technologies?: string;
};

export const logsRepository = {
  listByUid: (uid: string) => {
    const rows = db.prepare("SELECT * FROM logs WHERE uid = ? ORDER BY date DESC").all(uid) as LogRow[];
    return rows.map((log) => ({
      ...log,
      skills: parseJsonArray<string>(log.skills),
      missions: parseJsonArray<string>(log.missions),
      technologies: parseJsonArray<string>(log.technologies),
    }));
  },

  add: (
    id: string,
    uid: string,
    payload: {
      date: string;
      rawContent: string;
      structuredContent: string;
      skills?: string[];
      weekNumber: number;
      summary?: string;
      missions?: string[];
      technologies?: string[];
    },
  ) => {
    const stmt = db.prepare(`
      INSERT INTO logs (id, uid, date, rawContent, structuredContent, skills, weekNumber, summary, missions, technologies)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      uid,
      payload.date,
      payload.rawContent,
      payload.structuredContent,
      JSON.stringify(payload.skills || []),
      payload.weekNumber,
      payload.summary,
      JSON.stringify(payload.missions || []),
      JSON.stringify(payload.technologies || []),
    );
  },

  deleteByIdAndUid: (id: string, uid: string) => {
    const stmt = db.prepare("DELETE FROM logs WHERE id = ? AND uid = ?");
    stmt.run(id, uid);
  },
};
