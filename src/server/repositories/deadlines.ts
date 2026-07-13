import { db } from "../db";

type DeadlineRow = {
  id: string;
  uid: string;
  title: string;
  date: string;
  type: string;
  completed: number;
};

export const deadlinesRepository = {
  listByUid: (uid: string) => {
    const rows = db.prepare("SELECT * FROM deadlines WHERE uid = ? ORDER BY date ASC").all(uid) as DeadlineRow[];
    return rows.map((d) => ({ ...d, completed: !!d.completed }));
  },

  add: (
    id: string,
    uid: string,
    payload: {
      title: string;
      date: string;
      type: string;
      completed?: boolean;
    },
  ) => {
    const stmt = db.prepare(`
      INSERT INTO deadlines (id, uid, title, date, type, completed)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, uid, payload.title, payload.date, payload.type, payload.completed ? 1 : 0);
  },

  updateCompleted: (id: string, uid: string, completed: boolean) => {
    const stmt = db.prepare("UPDATE deadlines SET completed = ? WHERE id = ? AND uid = ?");
    stmt.run(completed ? 1 : 0, id, uid);
  },

  updateByIdAndUid: (
    id: string,
    uid: string,
    payload: { title?: string; date?: string; type?: string; completed?: boolean },
  ) => {
    const existing = db.prepare("SELECT * FROM deadlines WHERE id = ? AND uid = ?").get(id, uid) as
      | DeadlineRow
      | undefined;
    if (!existing) return false;

    const stmt = db.prepare("UPDATE deadlines SET title = ?, date = ?, type = ?, completed = ? WHERE id = ? AND uid = ?");
    stmt.run(
      payload.title ?? existing.title,
      payload.date ?? existing.date,
      payload.type ?? existing.type,
      payload.completed === undefined ? existing.completed : payload.completed ? 1 : 0,
      id,
      uid,
    );
    return true;
  },

  deleteByIdAndUid: (id: string, uid: string) => {
    const stmt = db.prepare("DELETE FROM deadlines WHERE id = ? AND uid = ?");
    stmt.run(id, uid);
  },
};
