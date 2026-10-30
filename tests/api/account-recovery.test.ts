import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { spawnSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDatabase, migrations } from "../../src/server/database.mjs";
import { inspectRecoveryTarget, resetLocalPassword } from "../../src/server/account-recovery.mjs";

const password = "BeforeRecovery123!";
const hash = bcrypt.hashSync(password, 4);
const email = "recover@stajio.dev";
const newPassword = "AfterRecovery123!";
let directory: string;
let databasePath: string;

function seed(legacy = false) {
  const connection = legacy ? new Database(databasePath) : openDatabase(databasePath).connection;
  if (legacy) migrations[0].up(connection);
  for (const [uid, address] of [
    ["main", email],
    ["other", "other@stajio.dev"],
  ]) {
    connection
      .prepare("INSERT INTO users (uid, email, displayName, password) VALUES (?, ?, ?, ?)")
      .run(uid, address, "Étudiant", hash);
    connection.prepare("INSERT INTO logs (id, uid, rawContent) VALUES (?, ?, ?)").run(`log-${uid}`, uid, "À conserver");
  }
  connection.close();
}

function readAccount(address = email) {
  const connection = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    return connection.prepare("SELECT * FROM users WHERE email = ?").get(address) as {
      uid: string;
      password: string;
      authVersion: number;
    };
  } finally {
    connection.close();
  }
}

beforeEach(() => {
  directory = mkdtempSync(path.join(os.tmpdir(), "stajio-account-recovery-"));
  databasePath = path.join(directory, "test.sqlite");
});
afterEach(() => {
  vi.restoreAllMocks();
  const resolved = path.resolve(directory);
  if (
    path.dirname(resolved) === path.resolve(os.tmpdir()) &&
    path.basename(resolved).startsWith("stajio-account-recovery-")
  ) {
    rmSync(resolved, { recursive: true, force: true });
  }
});

describe("Local password recovery", () => {
  it("refuses a missing file without creating it", async () => {
    await expect(resetLocalPassword(databasePath, email, newPassword)).rejects.toThrow();
    expect(existsSync(databasePath)).toBe(false);
    expect(readdirSync(directory)).toEqual([]);
  });

  it("rejects unrelated SQLite databases before any schema or file mutation", async () => {
    const connection = new Database(databasePath);
    connection.exec("CREATE TABLE users (uid TEXT, email TEXT, password TEXT)");
    connection.close();
    const before = readFileSync(databasePath);
    await expect(resetLocalPassword(databasePath, email, newPassword)).rejects.toThrow("base Stajio reconnue");
    expect(readFileSync(databasePath)).toEqual(before);
    expect(readdirSync(directory)).toEqual(["test.sqlite"]);
  });

  it("refuses an unknown email without changing the database", async () => {
    seed();
    const before = readFileSync(databasePath);
    await expect(resetLocalPassword(databasePath, "unknown@stajio.dev", newPassword)).rejects.toThrow("Aucun compte");
    expect(readFileSync(databasePath)).toEqual(before);
  });

  it("changes only the selected password and session version, preserving data and other accounts", async () => {
    seed();
    const other = readAccount("other@stajio.dev");
    await resetLocalPassword(databasePath, email, newPassword);
    const account = readAccount();
    expect(await bcrypt.compare(newPassword, account.password)).toBe(true);
    expect(await bcrypt.compare(password, account.password)).toBe(false);
    expect(account.authVersion).toBe(1);
    expect(readAccount("other@stajio.dev")).toEqual(other);
    const connection = new Database(databasePath, { readonly: true });
    try {
      expect(connection.prepare("SELECT rawContent FROM logs ORDER BY id").all()).toEqual([
        { rawContent: "À conserver" },
        { rawContent: "À conserver" },
      ]);
    } finally {
      connection.close();
    }
  });

  it("recognizes and backs up a legacy Stajio database before migrating it", async () => {
    seed(true);
    const result = await resetLocalPassword(databasePath, email, newPassword);
    expect(result.backupPath).toBeTruthy();
    expect(existsSync(result.backupPath!)).toBe(true);
    const backup = new Database(result.backupPath!, { readonly: true });
    try {
      expect(
        (backup.prepare("SELECT password FROM users WHERE email = ?").get(email) as { password: string }).password,
      ).toBe(hash);
      expect(backup.prepare("SELECT name FROM sqlite_master WHERE name = 'schema_migrations'").get()).toBeUndefined();
    } finally {
      backup.close();
    }
    expect(readAccount().authVersion).toBe(1);
  });

  it("refuses a credential change racing the asynchronous recovery hash", async () => {
    seed();
    vi.spyOn(bcrypt, "hash").mockImplementationOnce((async () => {
      const connection = new Database(databasePath);
      connection
        .prepare("UPDATE users SET authVersion = 4, password = ? WHERE email = ?")
        .run("concurrent-hash", email);
      connection.close();
      return hash;
    }) as typeof bcrypt.hash);
    await expect(resetLocalPassword(databasePath, email, newPassword)).rejects.toThrow("session a changé");
    expect(readAccount()).toMatchObject({ password: "concurrent-hash", authVersion: 4 });
  });

  it("rolls back password/version changes if a write fails", async () => {
    seed();
    const connection = new Database(databasePath);
    connection.exec(
      "CREATE TRIGGER stop_password_update BEFORE UPDATE ON users BEGIN SELECT RAISE(ABORT, 'write failed'); END",
    );
    connection.close();
    await expect(resetLocalPassword(databasePath, email, newPassword)).rejects.toThrow("write failed");
    expect(readAccount()).toMatchObject({ password: hash, authVersion: 0 });
  });
});

describe("Recovery CLI", () => {
  function run(extra: string[], input = "") {
    return spawnSync(
      process.execPath,
      [path.resolve("scripts/reset-password.mjs"), "--db", databasePath, "--email", email, ...extra],
      {
        input,
        encoding: "utf8",
        timeout: 10000,
        env: { ...process.env, STAJIO_DB_PATH: ":memory:" },
      },
    );
  }

  it("accepts an explicit two-line protected pipe without echoing the password", async () => {
    seed();
    const result = run(["--stdin"], `${newPassword}\n${newPassword}\n`);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout + result.stderr).not.toContain(newPassword);
    expect(result.stdout).toContain("anciennes sessions");
    expect(await bcrypt.compare(newPassword, readAccount().password)).toBe(true);
    expect(readAccount().authVersion).toBe(1);
  });

  it("requires the explicit stdin mode for non-interactive input", () => {
    seed();
    const result = run([], `${newPassword}\n${newPassword}\n`);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain(newPassword);
    expect(readAccount()).toMatchObject({ password: hash, authVersion: 0 });
  });

  it("rejects mismatching confirmation without a write or password leak", () => {
    seed();
    const result = run(["--stdin"], `${newPassword}\nMismatch123!\n`);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain(newPassword);
    expect(readAccount()).toMatchObject({ password: hash, authVersion: 0 });
  });

  it("rejects password command-line arguments without echoing them", () => {
    seed();
    const result = run(["--password", newPassword]);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain(newPassword);
    expect(readAccount()).toMatchObject({ password: hash, authVersion: 0 });
  });

  it("checks the target before consuming piped secrets", () => {
    expect(() => inspectRecoveryTarget(databasePath, email)).toThrow();
    const result = run(["--stdin"], `${newPassword}\n${newPassword}\n`);
    expect(result.status).toBe(1);
    expect(existsSync(databasePath)).toBe(false);
    expect(result.stdout + result.stderr).not.toContain(newPassword);
  });
});
