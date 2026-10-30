import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../src/server/db";
import { exportAccount } from "../../src/server/backup/service";
import { decodeBackup } from "../../src/server/backup/schemas";
import { GET } from "../../app/api/export/route";
import { requireAuth } from "../../src/server/route-auth";
import { ACCOUNT_CONTENT_TABLES } from "../../src/server/account-content";

vi.mock("../../src/server/route-auth", () => ({ requireAuth: vi.fn() }));

beforeEach(() => {
  db.exec(`${ACCOUNT_CONTENT_TABLES.map((table) => `DELETE FROM ${table};`).join(" ")} DELETE FROM users`);
  db.prepare("INSERT INTO users (uid, email, displayName, password) VALUES (?, ?, ?, ?)").run(
    "student",
    "student@example.test",
    "Étudiant",
    "private-password-hash",
  );
  db.prepare("INSERT INTO users (uid, email, displayName, password) VALUES (?, ?, ?, ?)").run(
    "other",
    "other@example.test",
    "Autre compte",
    "other-secret",
  );
  vi.mocked(requireAuth).mockResolvedValue({
    payload: { uid: "student", email: "student@example.test", authVersion: 0 },
  });
});

describe("Versioned account exports", () => {
  it("exports only the current account's business data and preserves nullable fields", () => {
    db.prepare(
      `INSERT INTO logs (id, uid, date, rawContent, structuredContent, skills, weekNumber, summary, missions, technologies)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "note",
      "student",
      "2026-10-27",
      "Mon activité",
      "Résumé",
      '["React"]',
      4,
      null,
      '["Mission"]',
      '["TypeScript"]',
    );
    db.prepare("INSERT INTO deadlines VALUES (?, ?, ?, ?, ?, ?)").run(
      "deadline",
      "student",
      "Rendu",
      "2026-11-02",
      "school",
      0,
    );
    db.prepare("INSERT INTO ai_outputs (id, uid, type, title, content, createdAt) VALUES (?, ?, ?, ?, ?, ?)").run(
      "output",
      "student",
      "report",
      "Rapport",
      "# Rapport",
      "2026-10-27T12:00:00.000Z",
    );
    db.prepare("INSERT INTO ai_outputs (id, uid, type, title, content, createdAt) VALUES (?, ?, ?, ?, ?, ?)").run(
      "private",
      "other",
      "cv",
      "Privé",
      "À ne pas exporter",
      "2026-10-27T12:00:00.000Z",
    );
    const backup = exportAccount("student");
    expect(backup).toMatchObject({ format: "stajio", version: 3, profile: { displayName: "Étudiant", school: null } });
    expect(backup.logs[0]).toMatchObject({ id: "note", summary: null, skills: ["React"], weekNumber: 4 });
    expect(backup.deadlines[0].completed).toBe(false);
    expect(backup.aiOutputs.map((output) => output.id)).toEqual(["output"]);
    expect(JSON.stringify(backup)).not.toMatch(
      /private-password-hash|other-secret|À ne pas exporter|student@example|"uid"|"email"|"password"|authVersion/,
    );
    expect(decodeBackup(backup).backup).toEqual(backup);
  });

  it("exports a newly registered account as a complete restorable document", () => {
    const backup = exportAccount("student");
    expect(backup.profile).toEqual({
      displayName: "Étudiant",
      school: null,
      degree: null,
      internshipStart: null,
      internshipEnd: null,
      company: null,
      tutorName: null,
    });
    expect(backup.logs).toEqual([]);
    expect(backup.deadlines).toEqual([]);
    expect(backup.aiOutputs).toEqual([]);
    expect(backup).toMatchObject({ drafts: [], reports: [], skills: [], conversations: [], simulations: [] });
    expect(decodeBackup(backup).sourceVersion).toBe(3);
  });

  it("refuses malformed stored data instead of silently losing it in the export", () => {
    db.prepare(
      `INSERT INTO logs (id, uid, date, rawContent, skills, missions, technologies, weekNumber)
      VALUES ('bad', 'student', '2026-10-27', 'À conserver', 'invalid json', '[]', '[]', 1)`,
    ).run();
    expect(() => exportAccount("student")).toThrow("export a été interrompu");
    expect(db.prepare("SELECT rawContent, skills FROM logs WHERE uid = 'student'").get()).toEqual({
      rawContent: "À conserver",
      skills: "invalid json",
    });
  });

  it("refuses a corrupt deadline status instead of converting it into a valid boolean", () => {
    db.prepare("INSERT INTO deadlines VALUES (?, ?, ?, ?, ?, ?)").run(
      "bad-status",
      "student",
      "Échéance",
      "2026-11-01",
      "school",
      2,
    );
    expect(() => exportAccount("student")).toThrow("état invalide");
    expect(db.prepare("SELECT completed FROM deadlines WHERE uid = 'student'").get()).toEqual({ completed: 2 });
  });

  it("serves a private downloadable document without a cache", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toContain("attachment;");
    expect((await response.json()).version).toBe(3);
  });

  it("requires authentication and fails clearly for a deleted account", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ error: new Response("Unauthorized", { status: 401 }) as never });
    expect((await GET()).status).toBe(401);
    expect(() => exportAccount("missing")).toThrow("n'existe plus");
  });
});
