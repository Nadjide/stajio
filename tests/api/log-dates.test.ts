import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../src/server/db";
import { usersRepository } from "../../src/server/repositories/users";
import { logsRepository } from "../../src/server/repositories/logs";
import { signAuthToken } from "../../src/server/auth";
import { GET as listLogs, POST as createLog } from "../../app/api/logs/route";
import { PUT as updateLog } from "../../app/api/logs/[id]/route";
import { POST as updateProfile } from "../../app/api/profile/route";

const session = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (session.token ? { value: session.token } : undefined) }),
}));

const uid = "date-student";
const otherUid = "date-other-student";
const profile = {
  displayName: "Étudiant",
  school: "École",
  degree: "Master",
  company: "Entreprise",
  tutorName: "Tuteur",
  internshipStart: "2026-10-21",
  internshipEnd: "2026-12-31",
};

function request(url: string, method: string, body: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function addNote(id = "note", owner = uid, date = "2026-10-27", weekNumber = 99) {
  logsRepository.add(id, owner, {
    date,
    rawContent: "Texte original à conserver",
    structuredContent: "Résumé",
    skills: ["React"],
    missions: ["Mission"],
    technologies: ["TypeScript"],
    weekNumber,
  });
}

beforeEach(() => {
  db.exec("DELETE FROM logs; DELETE FROM users;");
  usersRepository.create(uid, "date-student@example.test", "hash", profile.displayName);
  usersRepository.create(otherUid, "date-other@example.test", "hash", "Autre étudiant");
  usersRepository.updateProfile(uid, profile);
  usersRepository.updateProfile(otherUid, profile);
  session.token = signAuthToken({ uid, email: "date-student@example.test" });
});

describe("Server-owned internship weeks", () => {
  it("calculates weeks from the date and profile rather than trusting a client number", async () => {
    expect(
      (
        await createLog(
          request("/api/logs", "POST", {
            id: "first",
            date: "2026-10-27",
            rawContent: "Dernier jour de semaine 1",
            weekNumber: 999,
          }),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await createLog(
          request("/api/logs", "POST", {
            id: "second",
            date: "2026-10-28",
            rawContent: "Premier jour de semaine 2",
          }),
        )
      ).status,
    ).toBe(200);
    expect(logsRepository.listByUid(uid).map((log) => [log.id, log.weekNumber])).toEqual([
      ["second", 2],
      ["first", 1],
    ]);
  });

  it.each([
    ["2026-10-20", 0],
    ["2027-01-06", 12],
  ])("keeps a note outside the internship at %s with week %s", async (date, weekNumber) => {
    const response = await createLog(
      request("/api/logs", "POST", { date, rawContent: "Note hors période", weekNumber: 1 }),
    );
    expect(response.status).toBe(200);
    expect(logsRepository.listByUid(uid)[0].weekNumber).toBe(weekNumber);
  });

  it.each(["2026-02-30", "2026-04-31", "2026-99-99", "1900-02-29"])(
    "rejects an impossible note date %s without creating data",
    async (date) => {
      expect((await createLog(request("/api/logs", "POST", { date, rawContent: "Note" }))).status).toBe(400);
      expect(logsRepository.listByUid(uid)).toEqual([]);
    },
  );

  it("rejects a negative client week", async () => {
    expect(
      (
        await createLog(
          request("/api/logs", "POST", {
            date: "2026-10-27",
            rawContent: "Note",
            weekNumber: -1,
          }),
        )
      ).status,
    ).toBe(400);
    expect(logsRepository.listByUid(uid)).toEqual([]);
  });

  it("recalculates a week after editing the date or submitting only an incorrect week", async () => {
    addNote();
    const context = { params: Promise.resolve({ id: "note" }) };
    expect(
      (await updateLog(request("/api/logs/note", "PUT", { date: "2026-10-28", weekNumber: 99 }), context)).status,
    ).toBe(200);
    expect(logsRepository.listByUid(uid)[0]).toMatchObject({
      date: "2026-10-28",
      weekNumber: 2,
      rawContent: "Texte original à conserver",
    });
    expect((await updateLog(request("/api/logs/note", "PUT", { weekNumber: 98 }), context)).status).toBe(200);
    expect(logsRepository.listByUid(uid)[0].weekNumber).toBe(2);
    expect((await updateLog(request("/api/logs/note", "PUT", { date: "2026-10-20" }), context)).status).toBe(200);
    expect(logsRepository.listByUid(uid)[0].weekNumber).toBe(0);
  });

  it("returns consistent weeks even for legacy records with a stale stored week", async () => {
    addNote();
    const response = await listLogs();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([expect.objectContaining({ id: "note", weekNumber: 1 })]);
    expect(logsRepository.listByUid(uid)[0].rawContent).toBe("Texte original à conserver");
  });

  it("cannot change a note in another account", async () => {
    addNote("private", otherUid);
    const response = await updateLog(request("/api/logs/private", "PUT", { date: "2026-10-28" }), {
      params: Promise.resolve({ id: "private" }),
    });
    expect(response.status).toBe(404);
    expect(logsRepository.listByUid(otherUid)[0]).toMatchObject({ date: "2026-10-27", weekNumber: 99 });
  });

  it("requires a valid stage start before saving a new note", async () => {
    db.prepare("UPDATE users SET internshipStart = NULL WHERE uid = ?").run(uid);
    expect((await createLog(request("/api/logs", "POST", { date: "2026-10-27", rawContent: "Note" }))).status).toBe(
      409,
    );
    expect(logsRepository.listByUid(uid)).toEqual([]);
  });
});

describe("Profile date changes", () => {
  it("recalculates all own weeks without changing note content or another account", async () => {
    addNote("before");
    addNote("after", uid, "2026-11-04");
    addNote("before", otherUid);
    const response = await updateProfile(
      request("/api/profile", "POST", { ...profile, internshipStart: "2026-10-28" }),
    );
    expect(response.status).toBe(200);
    expect(logsRepository.listByUid(uid)).toEqual([
      expect.objectContaining({
        id: "after",
        weekNumber: 2,
        rawContent: "Texte original à conserver",
        skills: ["React"],
        missions: ["Mission"],
        technologies: ["TypeScript"],
      }),
      expect.objectContaining({ id: "before", weekNumber: 0, rawContent: "Texte original à conserver" }),
    ]);
    expect(logsRepository.listByUid(otherUid)[0].weekNumber).toBe(99);
    expect(usersRepository.findProfileByUid(otherUid)?.internshipStart).toBe("2026-10-21");
  });

  it("rejects inverted profile dates before changing the profile or its notes", async () => {
    addNote();
    const response = await updateProfile(request("/api/profile", "POST", { ...profile, internshipEnd: "2026-10-20" }));
    expect(response.status).toBe(400);
    expect(usersRepository.findProfileByUid(uid)?.internshipEnd).toBe("2026-12-31");
    expect(logsRepository.listByUid(uid)[0].weekNumber).toBe(99);
  });

  it("updates the profile and weeks atomically if recalculation fails", async () => {
    addNote();
    db.exec(
      "CREATE TRIGGER reject_recalculation BEFORE UPDATE OF weekNumber ON logs BEGIN SELECT RAISE(ABORT, 'recalculation failed'); END;",
    );
    try {
      await expect(
        updateProfile(request("/api/profile", "POST", { ...profile, internshipStart: "2026-10-28" })),
      ).rejects.toThrow("recalculation failed");
      expect(usersRepository.findProfileByUid(uid)?.internshipStart).toBe("2026-10-21");
      expect(logsRepository.listByUid(uid)[0].weekNumber).toBe(99);
    } finally {
      db.exec("DROP TRIGGER reject_recalculation");
    }
  });
});
