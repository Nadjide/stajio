import { db } from "../db";
import { createHash } from "node:crypto";
import { deleteAccountContent } from "../account-content";
import { assertBackupSize, BackupError, backupV3Schema, decodeBackup } from "./schemas";
import {
  BACKUP_COLLECTIONS,
  type BackupCounts,
  type BackupDocument,
  type BackupPreview,
  type BackupProfile,
} from "../../types/backup";

type AccountState = Omit<BackupDocument, "format" | "version" | "exportedAt">;

function storedJson(value: unknown, fallback: unknown = []): unknown {
  if (value === null || value === "") return fallback;
  try {
    return JSON.parse(String(value));
  } catch {
    throw new BackupError(
      "Certaines données enregistrées sont invalides ; l'export a été interrompu sans les modifier.",
      500,
    );
  }
}

const rows = (sql: string, uid: string) => db.prepare(sql).all(uid) as Array<Record<string, unknown>>;

function readAccountState(uid: string): AccountState {
  const profile = db
    .prepare(
      `
    SELECT displayName, school, degree, internshipStart, internshipEnd, company, tutorName
    FROM users WHERE uid = ?
  `,
    )
    .get(uid) as BackupProfile | undefined;
  if (!profile) throw new BackupError("Ce compte n'existe plus. Reconnecte-toi.", 404);

  const logs = rows(
    `SELECT id, date, rawContent, structuredContent, skills, weekNumber, summary, missions, technologies
    FROM logs WHERE uid = ? ORDER BY id`,
    uid,
  ).map((row) => ({
    ...row,
    skills: storedJson(row.skills),
    missions: storedJson(row.missions),
    technologies: storedJson(row.technologies),
  }));
  const deadlines = rows("SELECT id, title, date, type, completed FROM deadlines WHERE uid = ? ORDER BY id", uid);
  if (deadlines.some((row) => row.completed !== 0 && row.completed !== 1)) {
    throw new BackupError(
      "Certaines échéances enregistrées ont un état invalide ; l'export a été interrompu sans les modifier.",
      500,
    );
  }
  const aiOutputs = rows(
    "SELECT id, type, title, content, createdAt, updatedAt, model, instructions, sources FROM ai_outputs WHERE uid = ? ORDER BY id",
    uid,
  ).map((row) => ({ ...row, sources: storedJson(row.sources, null) }));
  const drafts = rows("SELECT key, content, updatedAt FROM drafts WHERE uid = ? ORDER BY key", uid);
  const reports = rows(
    `SELECT id, title, brief, sections, status, provenance, revision, createdAt, updatedAt, validatedAt
    FROM reports WHERE uid = ? ORDER BY id`,
    uid,
  ).map((row) => ({
    ...row,
    brief: storedJson(row.brief, null),
    sections: storedJson(row.sections),
    provenance: storedJson(row.provenance, null),
  }));
  const reportVersions = rows(
    "SELECT id, reportId, label, title, sections, createdAt FROM report_versions WHERE uid = ? ORDER BY id",
    uid,
  ).map((row) => ({ ...row, sections: storedJson(row.sections) }));
  const skills = rows("SELECT id, label, goal, level, createdAt, updatedAt FROM skills WHERE uid = ? ORDER BY id", uid);
  const skillEvidence = rows(
    "SELECT skillId, logId, createdAt FROM skill_evidence WHERE uid = ? ORDER BY skillId, logId",
    uid,
  );
  const conversations = rows(
    "SELECT id, title, createdAt, updatedAt FROM conversations WHERE uid = ? ORDER BY id",
    uid,
  );
  const conversationMessages = rows(
    `SELECT id, conversationId, position, role, content, status, model, createdAt
    FROM conversation_messages WHERE uid = ? ORDER BY conversationId, position`,
    uid,
  );
  const simulations = rows(
    "SELECT id, title, status, currentStep, steps, context, createdAt, updatedAt FROM simulations WHERE uid = ? ORDER BY id",
    uid,
  ).map((row) => ({ ...row, steps: storedJson(row.steps), context: storedJson(row.context, null) }));

  return {
    profile,
    logs,
    deadlines: deadlines.map((row) => ({ ...row, completed: Boolean(row.completed) })),
    aiOutputs,
    drafts,
    reports,
    reportVersions,
    skills,
    skillEvidence,
    conversations,
    conversationMessages,
    simulations,
  } as AccountState;
}

export function exportAccount(uid: string): BackupDocument {
  return db
    .transaction(() => {
      const document = {
        format: "stajio",
        version: 3,
        exportedAt: new Date().toISOString(),
        ...readAccountState(uid),
      };
      const parsed = backupV3Schema.safeParse(document);
      if (!parsed.success) {
        throw new BackupError(
          "Certaines données enregistrées ne peuvent pas être sauvegardées. Vérifie leurs dates et leur contenu avant de réessayer.",
          500,
        );
      }
      return assertBackupSize(parsed.data as BackupDocument);
    })
    .deferred();
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function counts(state: AccountState): BackupCounts {
  return Object.fromEntries(BACKUP_COLLECTIONS.map((name) => [name, state[name].length])) as BackupCounts;
}

export function previewRestore(uid: string, raw: unknown): BackupPreview {
  const { backup, sourceVersion } = decodeBackup(raw);
  return db
    .transaction(() => {
      const current = readAccountState(uid);
      return {
        version: sourceVersion,
        exportedAt: backup.exportedAt,
        profile: backup.profile,
        incoming: counts(backup),
        current: counts(current),
        backupHash: fingerprint(backup),
        currentHash: fingerprint({ uid, state: current }),
      };
    })
    .deferred();
}

const json = (value: unknown) => (value === null || value === undefined ? null : JSON.stringify(value));

function insertAccountState(uid: string, backup: BackupDocument) {
  const insertLog =
    db.prepare(`INSERT INTO logs (id, uid, date, rawContent, structuredContent, skills, weekNumber, summary, missions, technologies)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const log of backup.logs) {
    insertLog.run(
      log.id,
      uid,
      log.date,
      log.rawContent,
      log.structuredContent,
      JSON.stringify(log.skills),
      log.weekNumber,
      log.summary,
      JSON.stringify(log.missions),
      JSON.stringify(log.technologies),
    );
  }
  const insertDeadline = db.prepare(
    "INSERT INTO deadlines (id, uid, title, date, type, completed) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const deadline of backup.deadlines) {
    insertDeadline.run(deadline.id, uid, deadline.title, deadline.date, deadline.type, deadline.completed ? 1 : 0);
  }
  const insertOutput = db.prepare(
    `INSERT INTO ai_outputs (id, uid, type, title, content, createdAt, updatedAt, model, instructions, sources)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const output of backup.aiOutputs) {
    insertOutput.run(
      output.id,
      uid,
      output.type,
      output.title,
      output.content,
      output.createdAt,
      output.updatedAt,
      output.model,
      output.instructions,
      json(output.sources),
    );
  }
  const insertDraft = db.prepare("INSERT INTO drafts (uid, key, content, updatedAt) VALUES (?, ?, ?, ?)");
  for (const draft of backup.drafts) insertDraft.run(uid, draft.key, draft.content, draft.updatedAt);
  const insertReport = db.prepare(
    `INSERT INTO reports (id, uid, title, brief, sections, status, provenance, revision, createdAt, updatedAt, validatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const report of backup.reports) {
    insertReport.run(
      report.id,
      uid,
      report.title,
      JSON.stringify(report.brief),
      JSON.stringify(report.sections),
      report.status,
      json(report.provenance),
      report.revision,
      report.createdAt,
      report.updatedAt,
      report.validatedAt,
    );
  }
  const insertVersion = db.prepare(
    "INSERT INTO report_versions (id, uid, reportId, label, title, sections, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  for (const version of backup.reportVersions) {
    insertVersion.run(
      version.id,
      uid,
      version.reportId,
      version.label,
      version.title,
      JSON.stringify(version.sections),
      version.createdAt,
    );
  }
  const insertSkill = db.prepare(
    "INSERT INTO skills (id, uid, label, goal, level, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  for (const skill of backup.skills) {
    insertSkill.run(skill.id, uid, skill.label, skill.goal, skill.level, skill.createdAt, skill.updatedAt);
  }
  const insertEvidence = db.prepare("INSERT INTO skill_evidence (uid, skillId, logId, createdAt) VALUES (?, ?, ?, ?)");
  for (const link of backup.skillEvidence) insertEvidence.run(uid, link.skillId, link.logId, link.createdAt);
  const insertConversation = db.prepare(
    "INSERT INTO conversations (id, uid, title, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
  );
  for (const conversation of backup.conversations) {
    insertConversation.run(conversation.id, uid, conversation.title, conversation.createdAt, conversation.updatedAt);
  }
  const insertMessage = db.prepare(
    `INSERT INTO conversation_messages (id, uid, conversationId, position, role, content, status, model, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const message of backup.conversationMessages) {
    insertMessage.run(
      message.id,
      uid,
      message.conversationId,
      message.position,
      message.role,
      message.content,
      message.status,
      message.model,
      message.createdAt,
    );
  }
  const insertSimulation = db.prepare(
    `INSERT INTO simulations (id, uid, title, status, currentStep, steps, context, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const simulation of backup.simulations) {
    insertSimulation.run(
      simulation.id,
      uid,
      simulation.title,
      simulation.status,
      simulation.currentStep,
      JSON.stringify(simulation.steps),
      JSON.stringify(simulation.context),
      simulation.createdAt,
      simulation.updatedAt,
    );
  }
}

export function restoreAccount(
  uid: string,
  raw: unknown,
  expected: { backupHash: string; currentHash: string },
): BackupCounts {
  const { backup } = decodeBackup(raw);
  if (fingerprint(backup) !== expected.backupHash) {
    throw new BackupError("La sauvegarde a changé depuis l'aperçu. Affiche un nouvel aperçu avant de confirmer.", 409);
  }
  return db
    .transaction(() => {
      const current = readAccountState(uid);
      if (fingerprint({ uid, state: current }) !== expected.currentHash) {
        throw new BackupError(
          "Tes données ont changé depuis l'aperçu. Affiche un nouvel aperçu avant de confirmer.",
          409,
        );
      }
      deleteAccountContent(uid);
      const profile = backup.profile;
      db.prepare(
        `UPDATE users SET displayName = ?, school = ?, degree = ?, internshipStart = ?, internshipEnd = ?, company = ?, tutorName = ? WHERE uid = ?`,
      ).run(
        profile.displayName,
        profile.school,
        profile.degree,
        profile.internshipStart,
        profile.internshipEnd,
        profile.company,
        profile.tutorName,
        uid,
      );
      insertAccountState(uid, backup);
      return counts(backup);
    })
    .immediate();
}
