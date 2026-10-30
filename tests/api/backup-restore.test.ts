import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../src/server/db";
import { exportAccount, previewRestore, restoreAccount } from "../../src/server/backup/service";
import { decodeBackup, MAX_BACKUP_BYTES, MAX_BACKUP_DOCUMENT_BYTES } from "../../src/server/backup/schemas";
import { POST as previewPost } from "../../app/api/import/preview/route";
import { POST as restorePost } from "../../app/api/import/route";
import { requireAuth } from "../../src/server/route-auth";
import type { BackupDocument } from "../../src/types/backup";
import { ACCOUNT_CONTENT_TABLES } from "../../src/server/account-content";

vi.mock("../../src/server/route-auth", () => ({ requireAuth: vi.fn() }));

const section = (id: string, title: string, content: string) => ({
  id,
  title,
  intent: "",
  content,
  generatedAt: null,
  model: null,
});

function incoming(): BackupDocument {
  return {
    format: "stajio",
    version: 3,
    exportedAt: "2026-10-27T12:00:00.000Z",
    profile: {
      displayName: "Profil restauré",
      school: "École",
      degree: "Master",
      internshipStart: "2026-01-05",
      internshipEnd: "2026-12-18",
      company: "Entreprise",
      tutorName: "Tutrice",
    },
    logs: [
      {
        id: "note",
        date: "2026-10-20",
        rawContent: "Une mission documentée",
        structuredContent: "Résumé structuré",
        skills: ["React"],
        weekNumber: 42,
        summary: null,
        missions: ["Mission"],
        technologies: ["TypeScript"],
      },
    ],
    deadlines: [{ id: "deadline", title: "Rendu", date: "2026-11-01", type: "school", completed: true }],
    aiOutputs: [
      {
        id: "output",
        type: "cv",
        title: "Points CV corrigés",
        content: "- Mes corrections",
        createdAt: "2026-10-26T09:15:20.000Z",
        updatedAt: "2026-10-26T10:00:00.000Z",
        model: "phi4-mini",
        instructions: "v1-2026-10",
        sources: [{ id: "note", date: "2026-10-20", text: "Note du 2026-10-20 : Une mission documentée" }],
      },
    ],
    drafts: [
      {
        key: "journal:new",
        content: '{"date":"2026-10-21","text":"Brouillon"}',
        updatedAt: "2026-10-26T08:00:00.000Z",
      },
    ],
    reports: [
      {
        id: "report",
        title: "Mon rapport",
        brief: {
          guidelines: "30 pages",
          problem: "Comment ?",
          targetLength: "30 pages",
          periodStart: "2026-01-05",
          periodEnd: "2026-12-18",
          sourceLogIds: ["note"],
        },
        sections: [section("intro", "Introduction", "Texte corrigé")],
        status: "validated",
        provenance: {
          model: "phi4-mini",
          generatedAt: "2026-10-26T09:00:00.000Z",
          instructions: "Consignes : 30 pages",
          sources: [{ id: "note", date: "2026-10-20", text: "Instantané de la note" }],
        },
        revision: 4,
        createdAt: "2026-10-25T09:00:00.000Z",
        updatedAt: "2026-10-26T09:30:00.000Z",
        validatedAt: "2026-10-26T09:30:00.000Z",
      },
    ],
    reportVersions: [
      {
        id: "version",
        reportId: "report",
        label: "Avant régénération",
        title: "Mon rapport",
        sections: [section("intro", "Introduction", "Ancien texte")],
        createdAt: "2026-10-26T08:30:00.000Z",
      },
    ],
    skills: [
      {
        id: "skill",
        label: "Développer une interface",
        goal: "Autonomie",
        level: "practicing",
        createdAt: "2026-10-20T08:00:00.000Z",
        updatedAt: "2026-10-21T08:00:00.000Z",
      },
    ],
    skillEvidence: [{ skillId: "skill", logId: "note", createdAt: "2026-10-21T08:00:00.000Z" }],
    conversations: [
      { id: "chat", title: "Bilan", createdAt: "2026-10-22T08:00:00.000Z", updatedAt: "2026-10-22T08:05:00.000Z" },
    ],
    conversationMessages: [
      {
        id: "m1",
        conversationId: "chat",
        position: 1,
        role: "user",
        content: "Aide-moi",
        status: "complete",
        model: null,
        createdAt: "2026-10-22T08:00:00.000Z",
      },
      {
        id: "m2",
        conversationId: "chat",
        position: 2,
        role: "assistant",
        content: "Réponse partielle",
        status: "interrupted",
        model: "phi4-mini",
        createdAt: "2026-10-22T08:01:00.000Z",
      },
    ],
    simulations: [
      {
        id: "simulation",
        title: "Simulation",
        status: "in_progress",
        currentStep: 1,
        steps: [
          {
            question: "Présente-toi",
            answerHint: "Contexte",
            answer: "Je suis…",
            evaluation: { score: 6.5, feedback: "Bien", improvedAnswer: "Mieux" },
          },
          { question: "Une difficulté ?", answerHint: "", answer: null, evaluation: null },
        ],
        context: { model: "phi4-mini", generatedAt: "2026-10-23T08:00:00.000Z", sources: [] },
        createdAt: "2026-10-23T08:00:00.000Z",
        updatedAt: "2026-10-23T08:10:00.000Z",
      },
    ],
  };
}

const EMPTY_COLLECTIONS = {
  drafts: [],
  reports: [],
  reportVersions: [],
  skills: [],
  skillEvidence: [],
  conversations: [],
  conversationMessages: [],
  simulations: [],
};

const fullCounts = {
  logs: 1,
  deadlines: 1,
  aiOutputs: 1,
  drafts: 1,
  reports: 1,
  reportVersions: 1,
  skills: 1,
  skillEvidence: 1,
  conversations: 1,
  conversationMessages: 2,
  simulations: 1,
};

/** The version-2 shape of the same core data, as older Stajio exported it. */
function asVersion2(backup: BackupDocument) {
  return {
    format: "stajio",
    version: 2,
    exportedAt: backup.exportedAt,
    profile: backup.profile,
    logs: backup.logs,
    deadlines: backup.deadlines,
    aiOutputs: backup.aiOutputs.map(({ id, type, title, content, createdAt }) => ({
      id,
      type,
      title,
      content,
      createdAt,
    })),
  };
}

function request(body: unknown, endpoint = "import") {
  return new Request(`http://localhost/api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function state(uid = "student") {
  const { exportedAt: _exportedAt, ...businessData } = exportAccount(uid);
  return businessData;
}

function confirmed(backup: unknown) {
  const { backupHash, currentHash } = previewRestore("student", backup);
  return { backup, confirmation: "REMPLACER", backupHash, currentHash };
}

beforeEach(() => {
  db.exec(
    `DROP TRIGGER IF EXISTS fail_restore; ${ACCOUNT_CONTENT_TABLES.map((table) => `DELETE FROM ${table};`).join(" ")} DELETE FROM users`,
  );
  db.prepare(
    "INSERT INTO users (uid, email, displayName, password, school, internshipStart, internshipEnd, authVersion) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    "student",
    "student@example.test",
    "Profil actuel",
    "original-hash",
    "École actuelle",
    "2026-01-01",
    "2026-12-31",
    7,
  );
  db.prepare("INSERT INTO users (uid, email, displayName, password) VALUES (?, ?, ?, ?)").run(
    "other",
    "other@example.test",
    "Autre compte",
    "other-hash",
  );
  db.prepare(
    `INSERT INTO logs (id, uid, date, rawContent, structuredContent, skills, weekNumber, summary, missions, technologies)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run("old", "student", "2026-10-01", "Ancienne note", "Ancien résumé", "[]", 40, "Ancien résumé", "[]", "[]");
  // The same IDs already belong to another account: restoration must preserve both.
  db.prepare(
    `INSERT INTO logs (id, uid, date, rawContent, structuredContent, skills, weekNumber, summary, missions, technologies)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run("note", "other", "2026-10-01", "Note privée", "Résumé privé", "[]", 1, null, "[]", "[]");
  db.prepare("INSERT INTO deadlines VALUES (?, ?, ?, ?, ?, ?)").run(
    "deadline",
    "other",
    "Privé",
    "2026-11-02",
    "company",
    0,
  );
  db.prepare("INSERT INTO ai_outputs (id, uid, type, title, content, createdAt) VALUES (?, ?, ?, ?, ?, ?)").run(
    "output",
    "other",
    "cv",
    "Privé",
    "Contenu privé",
    "2026-10-01T12:00:00Z",
  );
  vi.mocked(requireAuth).mockResolvedValue({
    payload: { uid: "student", email: "student@example.test", authVersion: 7 },
  });
});

describe("Account restoration", () => {
  it("previews counts and profile without changing either account", async () => {
    const previous = state();
    const foreign = state("other");
    const response = await previewPost(request({ backup: incoming() }, "import/preview"));
    expect(response.status).toBe(200);
    const { preview } = await response.json();
    expect(preview).toMatchObject({
      version: 3,
      profile: { displayName: "Profil restauré" },
      incoming: fullCounts,
      current: { logs: 1, deadlines: 0, aiOutputs: 0, skills: 0, reports: 0, conversations: 0 },
    });
    expect(preview.backupHash).toMatch(/^[a-f0-9]{64}$/);
    expect(preview.currentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(state()).toEqual(previous);
    expect(state("other")).toEqual(foreign);
  });

  it("atomically replaces all business data while preserving IDs, nulls and account identity", async () => {
    const backup = incoming();
    const foreign = state("other");
    const identity = db.prepare("SELECT uid, email, password, authVersion FROM users WHERE uid = 'student'").get();
    const response = await restorePost(request(confirmed(backup)));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, imported: fullCounts });
    expect(state()).toEqual({ ...backup, exportedAt: undefined });
    expect(db.prepare("SELECT uid, email, password, authVersion FROM users WHERE uid = 'student'").get()).toEqual(
      identity,
    );
    expect(state("other")).toEqual(foreign);
    expect(db.prepare("SELECT COUNT(*) AS count FROM logs WHERE id = 'note'").get()).toEqual({ count: 2 });
  });

  it("restores the same document repeatedly without adding duplicates", () => {
    const backup = incoming();
    restoreAccount("student", backup, previewRestore("student", backup));
    const first = state();
    restoreAccount("student", backup, previewRestore("student", backup));
    expect(state()).toEqual(first);
    expect(first.logs).toHaveLength(1);
  });

  it("restores complete version-1 exports and ignores the source account's identity", () => {
    const backup = incoming();
    const core = asVersion2(backup);
    const legacy = {
      version: 1,
      exportedAt: backup.exportedAt,
      profile: { ...backup.profile, uid: "source", email: "source@example.test" },
      logs: core.logs.map((log) => ({ ...log, uid: "source" })),
      deadlines: core.deadlines.map((deadline) => ({ ...deadline, uid: "source" })),
      aiOutputs: core.aiOutputs.map((output) => ({ ...output, uid: "source" })),
    };
    expect(previewRestore("student", legacy).version).toBe(1);
    restoreAccount("student", legacy, previewRestore("student", legacy));
    expect(state()).toEqual({
      ...backup,
      ...EMPTY_COLLECTIONS,
      aiOutputs: core.aiOutputs.map((output) => ({
        ...output,
        updatedAt: null,
        model: null,
        instructions: null,
        sources: null,
      })),
      exportedAt: undefined,
    });
    expect(db.prepare("SELECT email FROM users WHERE uid = 'student'").get()).toEqual({
      email: "student@example.test",
    });
    legacy.logs[0].uid = "someone-else";
    expect(() => decodeBackup(legacy)).toThrow("Sauvegarde invalide");
  });

  it("restores an account before onboarding, including null profile values", () => {
    const backup = incoming();
    backup.profile = {
      displayName: "Nouveau profil",
      school: null,
      degree: null,
      internshipStart: null,
      internshipEnd: null,
      company: null,
      tutorName: null,
    };
    Object.assign(backup, EMPTY_COLLECTIONS, { logs: [], deadlines: [], aiOutputs: [] });
    restoreAccount("student", backup, previewRestore("student", backup));
    expect(state().profile).toEqual(backup.profile);
    expect(state().logs).toEqual([]);
  });

  it("rejects unconfirmed or old partial import requests without writing anything", async () => {
    const previous = state();
    expect((await restorePost(request({ backup: incoming() }))).status).toBe(400);
    expect((await restorePost(request({ logs: [] }))).status).toBe(400);
    expect(state()).toEqual(previous);
  });

  it("refuses changed backup content after the preview", async () => {
    const body = confirmed(incoming());
    const previous = state();
    (body.backup as BackupDocument).logs[0].rawContent = "Une autre sauvegarde";
    const response = await restorePost(request(body));
    expect(response.status).toBe(409);
    expect(state()).toEqual(previous);
  });

  it("refuses overwriting notes or profile changes made after the preview", async () => {
    const body = confirmed(incoming());
    db.prepare("UPDATE logs SET rawContent = 'Saisie récente' WHERE uid = 'student'").run();
    const latest = state();
    const response = await restorePost(request(body));
    expect(response.status).toBe(409);
    expect(state()).toEqual(latest);
  });

  it("does not treat unrelated changes in another account as a stale preview", () => {
    const backup = incoming();
    const preview = previewRestore("student", backup);
    db.prepare("UPDATE logs SET rawContent = 'Modification autre compte' WHERE uid = 'other'").run();
    expect(() => restoreAccount("student", backup, preview)).not.toThrow();
    expect(db.prepare("SELECT rawContent FROM logs WHERE uid = 'other'").get()).toEqual({
      rawContent: "Modification autre compte",
    });
  });

  it("rolls back profile and every collection when a SQL write fails mid-restore", async () => {
    const body = confirmed(incoming());
    const previous = state();
    const foreign = state("other");
    db.exec(`CREATE TRIGGER fail_restore BEFORE INSERT ON deadlines WHEN NEW.uid = 'student'
      BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END`);
    const response = await restorePost(request(body));
    expect(response.status).toBe(500);
    expect(state()).toEqual(previous);
    expect(state("other")).toEqual(foreign);
  });

  it.each([
    [
      "unknown version",
      (backup: Record<string, unknown>) => {
        backup.version = 4;
      },
    ],
    [
      "missing collection",
      (backup: Record<string, unknown>) => {
        delete backup.logs;
      },
    ],
    [
      "future collection",
      (backup: Record<string, unknown>) => {
        backup.attachments = [];
      },
    ],
    [
      "invalid date",
      (backup: BackupDocument) => {
        backup.logs[0].date = "2026-02-30";
      },
    ],
    [
      "reversed internship",
      (backup: BackupDocument) => {
        backup.profile.internshipEnd = "2025-01-01";
      },
    ],
    [
      "duplicate IDs",
      (backup: BackupDocument) => {
        backup.logs.push({ ...backup.logs[0] });
      },
    ],
  ])("rejects %s before any writes", async (_label, mutate) => {
    const backup = incoming();
    mutate(backup);
    const previous = state();
    const response = await previewPost(request({ backup }, "import/preview"));
    expect(response.status).toBe(400);
    expect(state()).toEqual(previous);
  });

  it("rejects malformed and oversized JSON, including a stream without a content-length header", async () => {
    const previous = state();
    const malformed = new Request("http://localhost/api/import/preview", { method: "POST", body: "not-json" });
    expect((await previewPost(malformed)).status).toBe(400);
    const oversizedHeader = new Request("http://localhost/api/import/preview", {
      method: "POST",
      headers: { "content-length": String(MAX_BACKUP_BYTES + 1) },
      body: "{}",
    });
    expect((await previewPost(oversizedHeader)).status).toBe(413);
    const oversizedBody = new Request("http://localhost/api/import/preview", {
      method: "POST",
      body: " ".repeat(MAX_BACKUP_BYTES + 1),
    });
    expect((await previewPost(oversizedBody)).status).toBe(413);
    expect(state()).toEqual(previous);
  });

  it("keeps a document near the export limit importable with its confirmation envelope", async () => {
    const outputContent = "x".repeat(Math.floor((MAX_BACKUP_DOCUMENT_BYTES - 8_000) / 20));
    const insert = db.prepare(
      "INSERT INTO ai_outputs (id, uid, type, title, content, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
    );
    for (let index = 0; index < 20; index++) {
      insert.run(`large-${index}`, "student", "report", "Rapport", outputContent, "2026-10-27T12:00:00Z");
    }
    const backup = exportAccount("student");
    const documentSize = Buffer.byteLength(JSON.stringify(backup));
    expect(MAX_BACKUP_DOCUMENT_BYTES - documentSize).toBeLessThan(10_000);
    expect(documentSize).toBeLessThanOrEqual(MAX_BACKUP_DOCUMENT_BYTES);
    const body = confirmed(backup);
    expect(Buffer.byteLength(JSON.stringify(body))).toBeLessThan(MAX_BACKUP_BYTES);
    const response = await restorePost(request(body));
    expect(response.status).toBe(200);
    expect((await response.json()).imported.aiOutputs).toBe(20);
  });

  it("restores links between skills, notes, reports, versions and conversations", () => {
    const backup = incoming();
    restoreAccount("student", backup, previewRestore("student", backup));
    expect(
      db
        .prepare(
          `SELECT s.label, l.rawContent FROM skill_evidence e
          JOIN skills s ON s.uid = e.uid AND s.id = e.skillId
          JOIN logs l ON l.uid = e.uid AND l.id = e.logId WHERE e.uid = 'student'`,
        )
        .all(),
    ).toEqual([{ label: "Développer une interface", rawContent: "Une mission documentée" }]);
    expect(db.prepare("SELECT reportId FROM report_versions WHERE uid = 'student'").all()).toEqual([
      { reportId: "report" },
    ]);
    expect(
      db.prepare("SELECT position, status FROM conversation_messages WHERE uid = 'student' ORDER BY position").all(),
    ).toEqual([
      { position: 1, status: "complete" },
      { position: 2, status: "interrupted" },
    ]);
  });

  it("upgrades a version-2 export and replaces newer collections with its genuinely empty ones", () => {
    restoreAccount("student", incoming(), previewRestore("student", incoming()));
    const legacy = asVersion2(incoming());
    const preview = previewRestore("student", legacy);
    expect(preview.version).toBe(2);
    expect(preview.incoming).toMatchObject({ logs: 1, skills: 0, reports: 0, conversations: 0 });
    expect(preview.current).toMatchObject({ skills: 1, reports: 1, conversations: 1 });
    restoreAccount("student", legacy, preview);
    expect(state()).toMatchObject({ version: 3, ...EMPTY_COLLECTIONS, logs: incoming().logs });
  });

  it.each([
    ["evidence for an unknown note", (backup: BackupDocument) => (backup.skillEvidence[0].logId = "missing")],
    ["evidence for an unknown skill", (backup: BackupDocument) => (backup.skillEvidence[0].skillId = "missing")],
    ["a version of an unknown report", (backup: BackupDocument) => (backup.reportVersions[0].reportId = "missing")],
    [
      "a message of an unknown conversation",
      (backup: BackupDocument) => (backup.conversationMessages[0].conversationId = "missing"),
    ],
    [
      "two skills differing only by case",
      (backup: BackupDocument) =>
        backup.skills.push({ ...backup.skills[0], id: "other", label: "DéVELOPPER UNE INTERFACE" }),
    ],
    ["two messages at the same position", (backup: BackupDocument) => (backup.conversationMessages[1].position = 1)],
    ["a simulation step out of range", (backup: BackupDocument) => (backup.simulations[0].currentStep = 9)],
    [
      "an evaluation score above 10",
      (backup: BackupDocument) => (backup.simulations[0].steps[0].evaluation!.score = 12),
    ],
  ])("rejects %s before any writes", async (_label, mutate) => {
    const backup = incoming();
    mutate(backup);
    const previous = state();
    expect((await previewPost(request({ backup }, "import/preview"))).status).toBe(400);
    expect(state()).toEqual(previous);
  });

  it("requires authentication for preview and restore", async () => {
    const denied = { error: new Response("Unauthorized", { status: 401 }) as never };
    vi.mocked(requireAuth).mockResolvedValue(denied);
    expect((await previewPost(request({ backup: incoming() }))).status).toBe(401);
    expect((await restorePost(request({}))).status).toBe(401);
  });
});
