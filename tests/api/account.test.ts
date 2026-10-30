import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { db } from "../../src/server/db";
import { signAuthToken, verifyAuthToken } from "../../src/server/auth";
import { registerSchema } from "../../src/server/validation";
import { POST as passwordPost } from "../../app/api/auth/password/route";
import { DELETE as accountDelete } from "../../app/api/account/route";
import { POST as loginPost } from "../../app/api/auth/login/route";

const session = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (session.token ? { value: session.token } : undefined) }),
}));

const password = "CurrentPass123!";
const hash = bcrypt.hashSync(password, 4);
const uid = "account-main";
const otherUid = "account-other";
const email = "main@stajio.dev";
let oldToken: string;
let otherToken: string;

function request(method: string, body: unknown) {
  return new Request("http://localhost:3001/api/account", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function counts(userId = uid) {
  return ["logs", "deadlines", "ai_outputs"].map(
    (table) =>
      (db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE uid = ?`).get(userId) as { count: number }).count,
  );
}
function responseToken(response: Response) {
  return response.headers.get("set-cookie")?.match(/token=([^;]*)/)?.[1] ?? "";
}

beforeEach(() => {
  for (const table of ["logs", "deadlines", "ai_outputs", "users"]) db.prepare(`DELETE FROM ${table}`).run();
  const insert = db.prepare(`INSERT INTO users (uid, email, displayName, password, school, degree,
    internshipStart, internshipEnd, company, tutorName) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const [id, address] of [
    [uid, email],
    [otherUid, "other@stajio.dev"],
  ]) {
    insert.run(id, address, "Étudiant", hash, "École", "Master", "2026-01-01", "2026-12-31", "Entreprise", "Tuteur");
    db.prepare("INSERT INTO logs (id, uid, date, rawContent, weekNumber) VALUES (?, ?, ?, ?, ?)").run(
      "shared-id",
      id,
      "2026-01-01",
      "Note privée",
      1,
    );
    db.prepare("INSERT INTO deadlines (id, uid, title, date) VALUES (?, ?, ?, ?)").run(
      "shared-id",
      id,
      "Rendu",
      "2026-12-01",
    );
    db.prepare("INSERT INTO ai_outputs (id, uid, type, title, content) VALUES (?, ?, ?, ?, ?)").run(
      "shared-id",
      id,
      "report",
      "Rapport",
      "Texte",
    );
  }
  oldToken = signAuthToken({ uid, email });
  otherToken = signAuthToken({ uid: otherUid, email: "other@stajio.dev" });
  session.token = oldToken;
});
afterEach(() => vi.restoreAllMocks());

describe("Account authentication and validation", () => {
  it.each(["password", "delete"])("requires authentication before %s validation", async (operation) => {
    session.token = undefined;
    const response =
      operation === "password" ? await passwordPost(request("POST", {})) : await accountDelete(request("DELETE", {}));
    expect(response.status).toBe(401);
    expect(counts()).toEqual([1, 1, 1]);
  });

  it.each(["data", "account"])("requires exact confirmation before deleting %s", async (scope) => {
    const response = await accountDelete(request("DELETE", { currentPassword: password, confirmation: "oui", scope }));
    expect(response.status).toBe(400);
    expect(counts()).toEqual([1, 1, 1]);
    expect(verifyAuthToken(oldToken)).not.toBeNull();
  });

  it.each(["data", "account"])("refuses a wrong password without changing %s", async (scope) => {
    const response = await accountDelete(
      request("DELETE", { currentPassword: "wrong", confirmation: "SUPPRIMER", scope }),
    );
    expect(response.status).toBe(403);
    expect(counts()).toEqual([1, 1, 1]);
    expect(verifyAuthToken(oldToken)).not.toBeNull();
  });

  it("uses the same UTF-8 password limit for registration and password changes", async () => {
    const tooLong = "é".repeat(37);
    expect(registerSchema.safeParse({ email, displayName: "Étudiant", password: tooLong }).success).toBe(false);
    const response = await passwordPost(request("POST", { currentPassword: password, newPassword: tooLong }));
    expect(response.status).toBe(400);
    expect(verifyAuthToken(oldToken)).not.toBeNull();
  });

  it("does not accept another account identifier in a destructive payload", async () => {
    const response = await accountDelete(
      request("DELETE", { currentPassword: password, confirmation: "SUPPRIMER", scope: "account", uid: otherUid }),
    );
    expect(response.status).toBe(400);
    expect(counts(otherUid)).toEqual([1, 1, 1]);
  });
});

describe("Password change", () => {
  it("does not create a login session from an old password after a concurrent reset", async () => {
    vi.spyOn(bcrypt, "compare").mockImplementationOnce((async () => {
      db.prepare("UPDATE users SET password = ?, authVersion = authVersion + 1 WHERE uid = ?").run(
        "newer-password-hash",
        uid,
      );
      return true;
    }) as typeof bcrypt.compare);
    const response = await loginPost(request("POST", { email, password }));
    expect(response.status).toBe(409);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("changes the password, revokes old sessions and renews only the current cookie", async () => {
    const newPassword = "NewPassword123!";
    const response = await passwordPost(request("POST", { currentPassword: password, newPassword }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    const current = db.prepare("SELECT password, authVersion FROM users WHERE uid = ?").get(uid) as {
      password: string;
      authVersion: number;
    };
    expect(await bcrypt.compare(newPassword, current.password)).toBe(true);
    expect(await bcrypt.compare(password, current.password)).toBe(false);
    expect(current.authVersion).toBe(1);
    expect(verifyAuthToken(oldToken)).toBeNull();
    expect(verifyAuthToken(responseToken(response))?.authVersion).toBe(1);
    expect(verifyAuthToken(otherToken)).not.toBeNull();
    expect(counts()).toEqual([1, 1, 1]);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("refuses a wrong current password", async () => {
    const response = await passwordPost(request("POST", { currentPassword: "wrong", newPassword: "NewPassword123!" }));
    expect(response.status).toBe(403);
    expect(verifyAuthToken(oldToken)).not.toBeNull();
  });

  it("refuses a reset that races the asynchronous hashing step", async () => {
    vi.spyOn(bcrypt, "hash").mockImplementationOnce((async () => {
      db.prepare("UPDATE users SET authVersion = authVersion + 1 WHERE uid = ?").run(uid);
      return hash;
    }) as typeof bcrypt.hash);
    const response = await passwordPost(request("POST", { currentPassword: password, newPassword: "NewPassword123!" }));
    expect(response.status).toBe(409);
    expect((db.prepare("SELECT password FROM users WHERE uid = ?").get(uid) as { password: string }).password).toBe(
      hash,
    );
    expect(counts()).toEqual([1, 1, 1]);
  });

  it("never signs a newer session after a concurrent reset", () => {
    db.prepare("UPDATE users SET authVersion = 2 WHERE uid = ?").run(uid);
    expect(() => signAuthToken({ uid, email }, 1)).toThrow("session a changé");
  });
});

describe("Data and account deletion", () => {
  it("clears only the current account's business data and stage, preserving its identity and password", async () => {
    const response = await accountDelete(
      request("DELETE", { currentPassword: password, confirmation: "SUPPRIMER", scope: "data" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, scope: "data" });
    expect(counts()).toEqual([0, 0, 0]);
    expect(counts(otherUid)).toEqual([1, 1, 1]);
    const user = db.prepare("SELECT * FROM users WHERE uid = ?").get(uid) as Record<string, unknown>;
    expect(user).toMatchObject({
      uid,
      email,
      displayName: "Étudiant",
      password: hash,
      school: null,
      degree: null,
      company: null,
      tutorName: null,
      internshipStart: null,
      internshipEnd: null,
      authVersion: 1,
    });
    expect(verifyAuthToken(oldToken)).toBeNull();
    expect(verifyAuthToken(responseToken(response))?.uid).toBe(uid);
    expect(verifyAuthToken(otherToken)).not.toBeNull();
  });

  it("deletes the account and children, expires its cookie and leaves another account intact", async () => {
    const response = await accountDelete(
      request("DELETE", { currentPassword: password, confirmation: "SUPPRIMER", scope: "account" }),
    );
    expect(response.status).toBe(200);
    expect(counts()).toEqual([0, 0, 0]);
    expect(db.prepare("SELECT uid FROM users WHERE uid = ?").get(uid)).toBeUndefined();
    expect(response.headers.get("set-cookie")).toContain("Expires=Thu, 01 Jan 1970");
    expect(verifyAuthToken(oldToken)).toBeNull();
    expect(verifyAuthToken(otherToken)).not.toBeNull();
    expect(counts(otherUid)).toEqual([1, 1, 1]);
  });

  it.each(["version", "hash"])("refuses a concurrent credential %s change before deleting data", async (field) => {
    vi.spyOn(bcrypt, "compare").mockImplementationOnce((async () => {
      if (field === "version") db.prepare("UPDATE users SET authVersion = authVersion + 1 WHERE uid = ?").run(uid);
      else db.prepare("UPDATE users SET password = ? WHERE uid = ?").run("newer-password-hash", uid);
      return true;
    }) as typeof bcrypt.compare);
    const response = await accountDelete(
      request("DELETE", { currentPassword: password, confirmation: "SUPPRIMER", scope: "data" }),
    );
    expect(response.status).toBe(409);
    expect(counts()).toEqual([1, 1, 1]);
    expect((db.prepare("SELECT school FROM users WHERE uid = ?").get(uid) as { school: string }).school).toBe("École");
  });

  it("rolls back child deletions and profile changes when a database write fails", async () => {
    db.exec(`CREATE TRIGGER refuse_account_delete BEFORE DELETE ON deadlines
      WHEN OLD.uid = 'account-main' BEGIN SELECT RAISE(ABORT, 'simulated private database failure'); END`);
    try {
      const response = await accountDelete(
        request("DELETE", { currentPassword: password, confirmation: "SUPPRIMER", scope: "account" }),
      );
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain("simulated private");
      expect(counts()).toEqual([1, 1, 1]);
      expect(counts(otherUid)).toEqual([1, 1, 1]);
      expect(verifyAuthToken(oldToken)).not.toBeNull();
    } finally {
      db.exec("DROP TRIGGER refuse_account_delete");
    }
  });
});
