import Database from "better-sqlite3";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase, migrations, openDatabase } from "../../src/server/database.mjs";

const directories: string[] = [];
const connections: Database.Database[] = [];
function fixture() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "stajio-migrations-"));
  directories.push(directory);
  const filename = path.join(directory, "legacy.db");
  const connection = new Database(filename);
  connections.push(connection);
  migrations[0].up(connection);
  connection
    .prepare("INSERT INTO users (uid, email, password, displayName) VALUES (?, ?, ?, ?)")
    .run("student", "student@example.test", "original-hash", "Étudiant");
  connection
    .prepare("INSERT INTO logs (id, uid, date, rawContent, weekNumber) VALUES (?, ?, ?, ?, ?)")
    .run("note", "student", "2026-10-27", "Texte à conserver", 1);
  return { directory, filename, connection };
}

afterEach(() => {
  for (const connection of connections.splice(0)) if (connection.open) connection.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("Versioned SQLite migrations", () => {
  it("creates a fresh database and records each migration once", () => {
    const { connection, version, backupPath } = openDatabase(":memory:");
    connections.push(connection);
    expect(version).toBe(migrations.length);
    expect(backupPath).toBeNull();
    expect(migrateDatabase(connection)).toEqual({ version: migrations.length, backupPath: null });
    expect(connection.prepare("SELECT COUNT(*) AS total FROM schema_migrations").get()).toEqual({
      total: migrations.length,
    });
  });

  it("snapshots a legacy database before migrating and preserves its data", () => {
    const { directory, connection } = fixture();
    const { backupPath } = migrateDatabase(connection);
    expect(backupPath).toBeTruthy();
    expect(readdirSync(path.join(directory, "backups"))).toHaveLength(1);
    expect(connection.prepare("SELECT rawContent FROM logs WHERE uid = 'student'").get()).toEqual({
      rawContent: "Texte à conserver",
    });
    expect(connection.prepare("SELECT password, authVersion FROM users WHERE uid = 'student'").get()).toEqual({
      password: "original-hash",
      authVersion: 0,
    });
    const snapshot = new Database(backupPath!, { readonly: true });
    connections.push(snapshot);
    expect(snapshot.prepare("SELECT rawContent FROM logs").get()).toEqual({ rawContent: "Texte à conserver" });
    expect(snapshot.prepare("SELECT 1 FROM sqlite_master WHERE name = 'schema_migrations'").get()).toBeUndefined();
    migrateDatabase(connection);
    expect(readdirSync(path.join(directory, "backups"))).toHaveLength(1);
  });

  it("allows the same record ID in two accounts after migration", () => {
    const { connection } = fixture();
    migrateDatabase(connection);
    connection.prepare("INSERT INTO users (uid, email) VALUES ('other', 'other@example.test')").run();
    connection.prepare("INSERT INTO logs (id, uid, rawContent) VALUES ('note', 'other', 'Autre compte')").run();
    expect(connection.prepare("SELECT COUNT(*) AS total FROM logs WHERE id = 'note'").get()).toEqual({ total: 2 });
  });

  it("supports concurrent server workers opening the same legacy database", async () => {
    const { filename, connection } = fixture();
    connection.close();
    const moduleUrl = pathToFileURL(path.resolve("src/server/database.mjs")).href;
    const script = `import {openDatabase} from ${JSON.stringify(moduleUrl)}; openDatabase(process.argv[1]).connection.close();`;
    await Promise.all(
      Array.from(
        { length: 4 },
        () =>
          new Promise<void>((resolve, reject) => {
            const child = spawn(process.execPath, ["--input-type=module", "-e", script, filename]);
            let errors = "";
            child.stderr.on("data", (chunk) => {
              errors += chunk;
            });
            child.on("error", reject);
            child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(errors))));
          }),
      ),
    );
    const reopened = openDatabase(filename).connection;
    connections.push(reopened);
    expect(reopened.prepare("SELECT COUNT(*) AS total FROM schema_migrations").get()).toEqual({
      total: migrations.length,
    });
    expect(reopened.prepare("SELECT rawContent FROM logs").get()).toEqual({ rawContent: "Texte à conserver" });
  });

  it("includes committed WAL records in the pre-migration snapshot", () => {
    const { connection } = fixture();
    connection.pragma("journal_mode = WAL");
    connection.prepare("UPDATE logs SET rawContent = 'WAL committed'").run();
    const { backupPath } = migrateDatabase(connection);
    const snapshot = new Database(backupPath!, { readonly: true });
    connections.push(snapshot);
    expect(snapshot.prepare("SELECT rawContent FROM logs").get()).toEqual({ rawContent: "WAL committed" });
  });

  it("rolls back the whole migration batch on failure, keeping its snapshot", () => {
    const { connection, directory } = fixture();
    expect(() =>
      migrateDatabase(connection, [
        ...migrations,
        {
          id: 4,
          name: "broken-test-migration",
          up(db) {
            db.exec("CREATE TABLE partial_change (id TEXT)");
            throw new Error("simulated failure");
          },
        },
      ]),
    ).toThrow("simulated failure");
    expect(connection.prepare("SELECT 1 FROM sqlite_master WHERE name = 'schema_migrations'").get()).toBeUndefined();
    expect(connection.prepare("SELECT 1 FROM sqlite_master WHERE name = 'partial_change'").get()).toBeUndefined();
    expect(connection.prepare("SELECT rawContent FROM logs").get()).toEqual({ rawContent: "Texte à conserver" });
    expect(readdirSync(path.join(directory, "backups"))).toHaveLength(1);
  });

  it("refuses a newer database without changing it", () => {
    const { connection } = fixture();
    migrateDatabase(connection);
    connection.prepare("INSERT INTO schema_migrations VALUES (99, 'future', '2026-10-27')").run();
    expect(() => migrateDatabase(connection)).toThrow("incompatible");
    expect(connection.prepare("SELECT COUNT(*) AS total FROM logs").get()).toEqual({ total: 1 });
  });

  it("does not migrate if the pre-migration snapshot cannot be written", () => {
    const { connection } = fixture();
    connection.pragma("query_only = ON");
    expect(() => migrateDatabase(connection)).toThrow();
    expect(connection.prepare("SELECT 1 FROM sqlite_master WHERE name = 'schema_migrations'").get()).toBeUndefined();
    expect(connection.prepare("SELECT rawContent FROM logs").get()).toEqual({ rawContent: "Texte à conserver" });
  });

  it("recovers a migration snapshot into a new file and refuses overwrites", () => {
    const { connection, directory } = fixture();
    const { backupPath } = migrateDatabase(connection);
    const output = path.join(directory, "recovered.db");
    const args = [path.resolve("scripts/db-recover.mjs"), "--backup", backupPath!, "--output", output];
    const first = spawnSync(process.execPath, args, { encoding: "utf8" });
    expect(first.status, first.stderr).toBe(0);
    const recovered = new Database(output, { readonly: true });
    connections.push(recovered);
    expect(recovered.prepare("SELECT rawContent FROM logs").get()).toEqual({ rawContent: "Texte à conserver" });
    expect(recovered.prepare("SELECT 1 FROM sqlite_master WHERE name = 'schema_migrations'").get()).toBeUndefined();
    expect(spawnSync(process.execPath, args, { encoding: "utf8" }).status).toBe(1);
  });
});
