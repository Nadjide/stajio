import { db } from "../db";
import { generateId, nowIso } from "../utils";
import type { Skill, SkillLevel } from "../../types/models";

type SkillRow = Omit<Skill, "logIds">;

export class SkillError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function evidenceByUid(uid: string) {
  const rows = db
    .prepare("SELECT skillId, logId FROM skill_evidence WHERE uid = ? ORDER BY createdAt, logId")
    .all(uid) as Array<{ skillId: string; logId: string }>;
  const map = new Map<string, string[]>();
  for (const row of rows) map.set(row.skillId, [...(map.get(row.skillId) ?? []), row.logId]);
  return map;
}

function assertLabelAvailable(uid: string, label: string, exceptId?: string) {
  const existing = db.prepare("SELECT id FROM skills WHERE uid = ? AND label = ? COLLATE NOCASE").get(uid, label) as
    | { id: string }
    | undefined;
  if (existing && existing.id !== exceptId) {
    throw new SkillError(`La compétence « ${label} » existe déjà. Fusionne-les plutôt que de créer un doublon.`, 409);
  }
}

function assertLogsExist(uid: string, logIds: string[]) {
  const check = db.prepare("SELECT 1 FROM logs WHERE uid = ? AND id = ?");
  for (const logId of logIds) {
    if (!check.get(uid, logId)) throw new SkillError("Une des notes choisies comme preuve n'existe plus.", 400);
  }
}

function replaceEvidence(uid: string, skillId: string, logIds: string[]) {
  assertLogsExist(uid, logIds);
  db.prepare("DELETE FROM skill_evidence WHERE uid = ? AND skillId = ?").run(uid, skillId);
  const insert = db.prepare(
    "INSERT OR IGNORE INTO skill_evidence (uid, skillId, logId, createdAt) VALUES (?, ?, ?, ?)",
  );
  const now = nowIso();
  for (const logId of logIds) insert.run(uid, skillId, logId, now);
}

export const skillsRepository = {
  list: (uid: string): Skill[] => {
    const evidence = evidenceByUid(uid);
    const rows = db
      .prepare(
        "SELECT id, label, goal, level, createdAt, updatedAt FROM skills WHERE uid = ? ORDER BY label COLLATE NOCASE",
      )
      .all(uid) as SkillRow[];
    return rows.map((row) => ({ ...row, logIds: evidence.get(row.id) ?? [] }));
  },

  get: (uid: string, id: string) => skillsRepository.list(uid).find((skill) => skill.id === id) ?? null,

  create: (uid: string, payload: { label: string; goal: string; level: SkillLevel; logIds: string[] }) => {
    return db
      .transaction(() => {
        assertLabelAvailable(uid, payload.label);
        const id = generateId();
        const now = nowIso();
        db.prepare(
          "INSERT INTO skills (id, uid, label, goal, level, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ).run(id, uid, payload.label, payload.goal, payload.level, now, now);
        replaceEvidence(uid, id, payload.logIds);
        return skillsRepository.get(uid, id)!;
      })
      .immediate();
  },

  update: (
    uid: string,
    id: string,
    payload: { label?: string; goal?: string; level?: SkillLevel; logIds?: string[] },
  ) => {
    return db
      .transaction(() => {
        const current = skillsRepository.get(uid, id);
        if (!current) return null;
        if (payload.label !== undefined) assertLabelAvailable(uid, payload.label, id);
        db.prepare("UPDATE skills SET label = ?, goal = ?, level = ?, updatedAt = ? WHERE uid = ? AND id = ?").run(
          payload.label ?? current.label,
          payload.goal ?? current.goal,
          payload.level ?? current.level,
          nowIso(),
          uid,
          id,
        );
        if (payload.logIds) replaceEvidence(uid, id, payload.logIds);
        return skillsRepository.get(uid, id);
      })
      .immediate();
  },

  /** Keeps the target's label and level, adds the source's evidence, then removes the source. */
  merge: (uid: string, sourceId: string, targetId: string) => {
    return db
      .transaction(() => {
        if (sourceId === targetId) throw new SkillError("Choisis deux compétences différentes à fusionner.", 400);
        const source = skillsRepository.get(uid, sourceId);
        const target = skillsRepository.get(uid, targetId);
        if (!source || !target) return null;
        replaceEvidence(uid, targetId, [...new Set([...target.logIds, ...source.logIds])]);
        if (!target.goal.trim() && source.goal.trim()) {
          db.prepare("UPDATE skills SET goal = ? WHERE uid = ? AND id = ?").run(source.goal, uid, targetId);
        }
        db.prepare("UPDATE skills SET updatedAt = ? WHERE uid = ? AND id = ?").run(nowIso(), uid, targetId);
        db.prepare("DELETE FROM skills WHERE uid = ? AND id = ?").run(uid, sourceId);
        return skillsRepository.get(uid, targetId);
      })
      .immediate();
  },

  delete: (uid: string, id: string) => {
    db.prepare("DELETE FROM skills WHERE uid = ? AND id = ?").run(uid, id);
  },
};
