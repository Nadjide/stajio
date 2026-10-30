import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { db } from "../../src/server/db";
import { signAuthToken } from "../../src/server/auth";
import { ACCOUNT_CONTENT_TABLES } from "../../src/server/account-content";
import { POST as onboardingPost } from "../../app/api/onboarding/route";
import { DELETE as draftDelete, GET as draftGet, PUT as draftPut } from "../../app/api/drafts/[key]/route";
import { GET as skillsGet, POST as skillsPost } from "../../app/api/skills/route";
import { PATCH as skillPatch } from "../../app/api/skills/[id]/route";
import { POST as skillsMerge } from "../../app/api/skills/merge/route";
import { DELETE as logDelete } from "../../app/api/logs/[id]/route";
import { POST as logsPost } from "../../app/api/logs/route";
import { POST as reportsPost } from "../../app/api/reports/route";
import { GET as reportGet, PUT as reportPut } from "../../app/api/reports/[id]/route";
import { GET as versionsGet, POST as versionsPost } from "../../app/api/reports/[id]/versions/route";
import { POST as versionRestore } from "../../app/api/reports/[id]/versions/[versionId]/route";
import { POST as conversationsPost } from "../../app/api/conversations/route";
import { GET as conversationGet } from "../../app/api/conversations/[id]/route";
import { POST as messagesPost } from "../../app/api/conversations/[id]/messages/route";
import { POST as simulationsPost } from "../../app/api/simulations/route";
import { POST as answerPost } from "../../app/api/simulations/[id]/answer/route";
import { GET as calendarGet } from "../../app/api/deadlines/calendar/route";
import { DELETE as accountDelete } from "../../app/api/account/route";
import { deadlinesToIcs } from "../../src/utils/calendar";
import type { Report } from "../../src/types/models";

const session = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (session.token ? { value: session.token } : undefined) }),
}));

const fetchMock = vi.fn();
const encoder = new TextEncoder();
const PASSWORD = "Workspace-Test-2026!";
let passwordHash = "";

const profile = {
  displayName: "Camille",
  school: "École",
  degree: "Master",
  company: "Entreprise",
  tutorName: "",
  internshipStart: "2026-09-01",
  internshipEnd: "2027-02-28",
};

function call(url: string, method: string, body?: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const params = <T extends Record<string, string>>(value: T) => ({ params: Promise.resolve(value) });

function login(uid: string) {
  session.token = signAuthToken({ uid, email: `${uid}@example.test` });
}

function createUser(uid: string, withProfile = true) {
  db.prepare("INSERT INTO users (uid, email, password, displayName) VALUES (?, ?, ?, ?)").run(
    uid,
    `${uid}@example.test`,
    passwordHash,
    "Camille",
  );
  if (withProfile) {
    db.prepare(
      "UPDATE users SET school = ?, degree = ?, company = ?, internshipStart = ?, internshipEnd = ? WHERE uid = ?",
    ).run(profile.school, profile.degree, profile.company, profile.internshipStart, profile.internshipEnd, uid);
  }
}

async function addNote(id: string, rawContent = "Note du journal") {
  expect((await logsPost(call("/api/logs", "POST", { id, date: "2026-10-01", rawContent }))).status).toBe(200);
}

function ollamaStream(lines: unknown[]) {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const line of lines) controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
        controller.close();
      },
    }),
  );
}

const ollamaJson = (content: unknown) =>
  new Response(JSON.stringify({ message: { content: JSON.stringify(content) } }), { status: 200 });

beforeEach(async () => {
  passwordHash ||= await bcrypt.hash(PASSWORD, 4);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  db.exec(`${ACCOUNT_CONTENT_TABLES.map((table) => `DELETE FROM ${table};`).join(" ")} DELETE FROM users;`);
  createUser("student");
  createUser("intruder");
  login("student");
});

afterEach(() => vi.unstubAllGlobals());

describe("Onboarding", () => {
  beforeEach(() => {
    db.exec("DELETE FROM users WHERE uid = 'newcomer'");
    createUser("newcomer", false);
    login("newcomer");
  });

  it("saves the profile and only the confirmed deadlines together", async () => {
    const response = await onboardingPost(
      call("/api/onboarding", "POST", {
        profile,
        deadlines: [{ title: "Point mi-parcours", date: "2026-11-29", type: "company" }],
      }),
    );
    expect(response.status).toBe(200);
    expect(db.prepare("SELECT company FROM users WHERE uid = 'newcomer'").get()).toEqual({ company: "Entreprise" });
    expect(db.prepare("SELECT title, date FROM deadlines WHERE uid = 'newcomer'").all()).toEqual([
      { title: "Point mi-parcours", date: "2026-11-29" },
    ]);
  });

  it("refuses a repeated submission instead of duplicating deadlines", async () => {
    const body = { profile, deadlines: [{ title: "Rendu", date: "2027-02-14", type: "school" }] };
    expect((await onboardingPost(call("/api/onboarding", "POST", body))).status).toBe(200);
    expect((await onboardingPost(call("/api/onboarding", "POST", body))).status).toBe(409);
    expect(db.prepare("SELECT COUNT(*) AS total FROM deadlines WHERE uid = 'newcomer'").get()).toEqual({ total: 1 });
  });

  it("writes nothing when a deadline date is invalid", async () => {
    const response = await onboardingPost(
      call("/api/onboarding", "POST", { profile, deadlines: [{ title: "Soutenance", date: "", type: "school" }] }),
    );
    expect(response.status).toBe(400);
    expect(db.prepare("SELECT company FROM users WHERE uid = 'newcomer'").get()).toEqual({ company: null });
  });
});

describe("Drafts", () => {
  it("are stored per account and can be cleared", async () => {
    const key = params({ key: "journal:new" });
    expect(
      (await draftPut(call("/api/drafts/journal:new", "PUT", { content: '{"text":"Brouillon"}' }), key)).status,
    ).toBe(200);
    expect((await (await draftGet(call("/api/drafts/journal:new", "GET"), key)).json()).draft.content).toBe(
      '{"text":"Brouillon"}',
    );
    login("intruder");
    expect((await (await draftGet(call("/api/drafts/journal:new", "GET"), key)).json()).draft).toBeNull();
    login("student");
    await draftDelete(call("/api/drafts/journal:new", "DELETE"), key);
    expect((await (await draftGet(call("/api/drafts/journal:new", "GET"), key)).json()).draft).toBeNull();
  });

  it("reject unexpected keys", async () => {
    expect((await draftGet(call("/api/drafts/x", "GET"), params({ key: "../secret" }))).status).toBe(400);
  });
});

describe("Skills and evidence", () => {
  it("links notes, refuses duplicates and foreign evidence, merges and follows note deletion", async () => {
    await addNote("a");
    await addNote("b");
    const created = await (
      await skillsPost(call("/api/skills", "POST", { label: "Tester une API", logIds: ["a"] }))
    ).json();
    expect(created).toMatchObject({ label: "Tester une API", level: "to_work", logIds: ["a"] });
    expect((await skillsPost(call("/api/skills", "POST", { label: "tester une api" }))).status).toBe(409);

    login("intruder");
    db.prepare(
      "INSERT INTO logs (id, uid, date, rawContent) VALUES ('foreign', 'intruder', '2026-10-01', 'Privé')",
    ).run();
    login("student");
    expect(
      (await skillPatch(call("/api/skills/x", "PATCH", { logIds: ["foreign"] }), params({ id: created.id }))).status,
    ).toBe(400);

    const duplicate = await (
      await skillsPost(call("/api/skills", "POST", { label: "Tests d'API", goal: "Automatiser", logIds: ["b"] }))
    ).json();
    const merged = await (
      await skillsMerge(call("/api/skills/merge", "POST", { sourceId: duplicate.id, targetId: created.id }))
    ).json();
    expect(merged).toMatchObject({ label: "Tester une API", goal: "Automatiser", logIds: ["a", "b"] });
    expect(await (await skillsGet()).json()).toHaveLength(1);

    await logDelete(call("/api/logs/a", "DELETE"), params({ id: "a" }));
    expect((await (await skillsGet()).json())[0].logIds).toEqual(["b"]);
  });
});

describe("Reports", () => {
  it("creates a report from the profile period and every note", async () => {
    await addNote("a");
    const report = (await (await reportsPost(call("/api/reports", "POST", {}))).json()) as Report;
    expect(report.brief).toMatchObject({ periodStart: "2026-09-01", periodEnd: "2027-02-28", sourceLogIds: ["a"] });
    expect(report.sections.length).toBeGreaterThan(3);
    expect(report.revision).toBe(1);
  });

  it("rejects a stale revision so another tab cannot overwrite corrections", async () => {
    const report = (await (await reportsPost(call("/api/reports", "POST", {}))).json()) as Report;
    const save = (revision: number, content: string) =>
      reportPut(
        call(`/api/reports/${report.id}`, "PUT", {
          revision,
          title: report.title,
          brief: report.brief,
          sections: [{ ...report.sections[0], content }],
          status: "draft",
        }),
        params({ id: report.id }),
      );
    expect((await save(1, "Première correction")).status).toBe(200);
    const conflict = await save(1, "Onglet en retard");
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).current.sections[0].content).toBe("Première correction");
  });

  it("keeps versions and saves the current text before restoring an older one", async () => {
    const report = (await (await reportsPost(call("/api/reports", "POST", {}))).json()) as Report;
    const id = params({ id: report.id });
    const write = async (revision: number, content: string) =>
      (await (
        await reportPut(
          call(`/api/reports/${report.id}`, "PUT", {
            revision,
            title: report.title,
            brief: report.brief,
            sections: [{ ...report.sections[0], content }],
            status: "validated",
          }),
          id,
        )
      ).json()) as Report;
    const first = await write(1, "Version relue");
    expect(first.validatedAt).toBeTruthy();
    const version = await (await versionsPost(call("/x", "POST", { label: "Envoyée au tuteur" }), id)).json();
    const second = await write(first.revision, "Texte remanié");
    const restored = (await (
      await versionRestore(
        call("/x", "POST", { revision: second.revision }),
        params({ id: report.id, versionId: version.id }),
      )
    ).json()) as Report;
    expect(restored.sections[0].content).toBe("Version relue");
    expect(restored.status).toBe("draft");
    const labels = (await (await versionsGet(call("/x", "GET"), id)).json()).map(
      (item: { label: string }) => item.label,
    );
    expect(labels).toEqual(["Avant restauration de « Envoyée au tuteur »", "Envoyée au tuteur"]);
  });

  it("is invisible to another account", async () => {
    const report = (await (await reportsPost(call("/api/reports", "POST", {}))).json()) as Report;
    login("intruder");
    expect((await reportGet(call("/x", "GET"), params({ id: report.id }))).status).toBe(404);
    expect((await versionsGet(call("/x", "GET"), params({ id: report.id }))).status).toBe(404);
  });
});

describe("Conversations", () => {
  async function newConversation() {
    return (await (await conversationsPost(call("/api/conversations", "POST", {}))).json()).id as string;
  }
  const send = (id: string, body: unknown) =>
    messagesPost(call(`/api/conversations/${id}/messages`, "POST", body), params({ id }));
  const messages = async (id: string) =>
    (await (await conversationGet(call("/x", "GET"), params({ id }))).json()).messages;

  it("stores both sides of a completed exchange and titles the conversation", async () => {
    const id = await newConversation();
    fetchMock.mockResolvedValue(
      ollamaStream([{ message: { content: "Bonjour" } }, { message: { content: "" }, done: true }]),
    );
    await (await send(id, { content: "Aide-moi pour mon bilan", clientMessageId: "client-message-1" })).text();
    expect(await messages(id)).toMatchObject([
      { role: "user", content: "Aide-moi pour mon bilan", status: "complete" },
      { role: "assistant", content: "Bonjour", status: "complete" },
    ]);
    expect((await (await conversationGet(call("/x", "GET"), params({ id }))).json()).title).toBe(
      "Aide-moi pour mon bilan",
    );
    const resent = await send(id, { content: "Aide-moi pour mon bilan", clientMessageId: "client-message-1" });
    expect(resent.status).toBe(409);
    expect(await messages(id)).toHaveLength(2);
  });

  it("keeps an interrupted reply and replaces it on retry without duplicating", async () => {
    const id = await newConversation();
    fetchMock.mockResolvedValue(ollamaStream([{ message: { content: "Début de réponse" } }]));
    const body = await (await send(id, { content: "Question", clientMessageId: "client-message-2" })).text();
    expect(body).toContain('"type":"error"');
    expect(await messages(id)).toMatchObject([
      { role: "user", status: "complete" },
      { role: "assistant", content: "Début de réponse", status: "interrupted" },
    ]);
    fetchMock.mockResolvedValue(ollamaStream([{ message: { content: "Réponse complète" } }, { done: true }]));
    await (await send(id, { retry: true })).text();
    expect(await messages(id)).toMatchObject([
      { role: "user", content: "Question" },
      { role: "assistant", content: "Réponse complète", status: "complete" },
    ]);
    const history = JSON.parse(fetchMock.mock.calls.at(-1)![1].body).messages;
    expect(history.map((message: { content: string }) => message.content)).not.toContain("Début de réponse");
  });

  it("keeps the question when Ollama is unreachable so it can be retried", async () => {
    const id = await newConversation();
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const body = await (await send(id, { content: "Question", clientMessageId: "client-message-3" })).text();
    expect(body).toContain('"code":"unreachable"');
    expect(await messages(id)).toMatchObject([{ role: "user", content: "Question" }]);
  });

  it("refuses access from another account", async () => {
    const id = await newConversation();
    login("intruder");
    expect((await conversationGet(call("/x", "GET"), params({ id }))).status).toBe(404);
    expect((await send(id, { content: "Intrusion", clientMessageId: "client-message-4" })).status).toBe(404);
  });
});

describe("Defense simulations", () => {
  it("stores the session, then each answer before and after its evaluation", async () => {
    await addNote("a");
    fetchMock.mockResolvedValue(
      ollamaJson({ plan: ["Intro"], questions: [{ question: "Présente-toi", answerHint: "Court" }] }),
    );
    const simulation = await (await simulationsPost(call("/api/simulations", "POST", {}))).json();
    expect(simulation).toMatchObject({ status: "in_progress", currentStep: 0, context: { sources: [{ id: "a" }] } });

    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const failed = await answerPost(
      call("/x", "POST", { index: 0, answer: "Je suis Camille" }),
      params({ id: simulation.id }),
    );
    expect(failed.status).toBe(503);
    const stored = db.prepare("SELECT steps FROM simulations WHERE id = ?").get(simulation.id) as { steps: string };
    expect(JSON.parse(stored.steps)[0]).toMatchObject({ answer: "Je suis Camille", evaluation: null });

    fetchMock.mockResolvedValue(ollamaJson({ score: 8, feedback: "Clair", improvedAnswer: "Mieux" }));
    const evaluated = await (
      await answerPost(call("/x", "POST", { index: 0, answer: "Je suis Camille" }), params({ id: simulation.id }))
    ).json();
    expect(evaluated.steps[0].evaluation).toEqual({ score: 8, feedback: "Clair", improvedAnswer: "Mieux" });
  });
});

describe("Calendar export", () => {
  it("produces importable all-day events with escaped text and folded lines", async () => {
    const ics = deadlinesToIcs(
      [
        {
          id: "d1",
          uid: "student",
          title: "Rendu; rapport, version 1",
          date: "2026-12-31",
          type: "school",
          completed: false,
        },
        { id: "d2", uid: "student", title: "É".repeat(60), date: "2026-11-02", type: "company", completed: true },
      ],
      new Date("2026-10-28T10:00:00Z"),
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101");
    expect(ics).toContain("SUMMARY:Rendu\\; rapport\\, version 1");
    expect(ics).toContain("DTSTAMP:20261028T100000Z");
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);

    const response = await calendarGet();
    expect(response.headers.get("content-type")).toContain("text/calendar");
  });
});

describe("Account deletion", () => {
  it("removes every new collection of the account and nothing of others", async () => {
    await addNote("a");
    await skillsPost(call("/api/skills", "POST", { label: "API", logIds: ["a"] }));
    await reportsPost(call("/api/reports", "POST", {}));
    await conversationsPost(call("/api/conversations", "POST", {}));
    await draftPut(call("/x", "PUT", { content: "{}" }), params({ key: "journal:new" }));
    login("intruder");
    await conversationsPost(call("/api/conversations", "POST", {}));
    login("student");
    const response = await accountDelete(
      call("/api/account", "DELETE", { currentPassword: PASSWORD, confirmation: "SUPPRIMER", scope: "account" }),
    );
    expect(response.status).toBe(200);
    for (const table of ACCOUNT_CONTENT_TABLES) {
      expect(db.prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE uid = 'student'`).get()).toEqual({ total: 0 });
    }
    expect(db.prepare("SELECT COUNT(*) AS total FROM conversations WHERE uid = 'intruder'").get()).toEqual({
      total: 1,
    });
  });
});
