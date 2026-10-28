import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

/** @typedef {import('better-sqlite3').Database} SqliteDatabase */

// Applied migrations are immutable: add a new entry when the schema evolves.
export const migrations = [
  {
    id: 1,
    name: "initial-schema",
    /** @param {SqliteDatabase} connection */
    up(connection) {
      connection.exec(`
        CREATE TABLE IF NOT EXISTS users (
          uid TEXT PRIMARY KEY, email TEXT UNIQUE, displayName TEXT,
          school TEXT, degree TEXT, internshipStart TEXT, internshipEnd TEXT,
          company TEXT, tutorName TEXT, password TEXT
        );
        CREATE TABLE IF NOT EXISTS logs (
          id TEXT PRIMARY KEY, uid TEXT, date TEXT, rawContent TEXT,
          structuredContent TEXT, skills TEXT, weekNumber INTEGER,
          summary TEXT, missions TEXT, technologies TEXT,
          FOREIGN KEY(uid) REFERENCES users(uid)
        );
        CREATE TABLE IF NOT EXISTS deadlines (
          id TEXT PRIMARY KEY, uid TEXT, title TEXT, date TEXT,
          type TEXT, completed INTEGER,
          FOREIGN KEY(uid) REFERENCES users(uid)
        );
        CREATE TABLE IF NOT EXISTS ai_outputs (
          id TEXT PRIMARY KEY, uid TEXT, type TEXT, title TEXT,
          content TEXT, createdAt TEXT,
          FOREIGN KEY(uid) REFERENCES users(uid)
        );
      `);
    },
  },
  {
    id: 2,
    name: "account-scoped-identifiers",
    /** @param {SqliteDatabase} connection */
    up(connection) {
      // Preserve IDs when restoring in another account.
      connection.exec(`
        CREATE TABLE logs_v2 (
          id TEXT, uid TEXT, date TEXT, rawContent TEXT,
          structuredContent TEXT, skills TEXT, weekNumber INTEGER,
          summary TEXT, missions TEXT, technologies TEXT,
          PRIMARY KEY(uid, id), FOREIGN KEY(uid) REFERENCES users(uid)
        );
        INSERT INTO logs_v2 SELECT * FROM logs;
        DROP TABLE logs;
        ALTER TABLE logs_v2 RENAME TO logs;
        CREATE INDEX logs_user_date ON logs(uid, date);
        CREATE TABLE deadlines_v2 (
          id TEXT, uid TEXT, title TEXT, date TEXT, type TEXT, completed INTEGER,
          PRIMARY KEY(uid, id), FOREIGN KEY(uid) REFERENCES users(uid)
        );
        INSERT INTO deadlines_v2 SELECT * FROM deadlines;
        DROP TABLE deadlines;
        ALTER TABLE deadlines_v2 RENAME TO deadlines;
        CREATE INDEX deadlines_user_date ON deadlines(uid, date);
        CREATE TABLE ai_outputs_v2 (
          id TEXT, uid TEXT, type TEXT, title TEXT, content TEXT, createdAt TEXT,
          PRIMARY KEY(uid, id), FOREIGN KEY(uid) REFERENCES users(uid)
        );
        INSERT INTO ai_outputs_v2 SELECT * FROM ai_outputs;
        DROP TABLE ai_outputs;
        ALTER TABLE ai_outputs_v2 RENAME TO ai_outputs;
        CREATE INDEX ai_outputs_user_date ON ai_outputs(uid, createdAt);
      `);
    },
  },
  {
    id: 3,
    name: "revocable-auth-sessions",
    /** @param {SqliteDatabase} connection */
    up(connection) {
      connection.exec("ALTER TABLE users ADD COLUMN authVersion INTEGER NOT NULL DEFAULT 0");
    },
  },
  {
    id: 4,
    name: "account-drafts",
    /** @param {SqliteDatabase} connection */
    up(connection) {
      connection.exec(`
        CREATE TABLE drafts (
          uid TEXT NOT NULL, key TEXT NOT NULL, content TEXT NOT NULL, updatedAt TEXT NOT NULL,
          PRIMARY KEY(uid, key), FOREIGN KEY(uid) REFERENCES users(uid)
        );
      `);
    },
  },
  {
    id: 5,
    name: "ai-provenance-and-reports",
    /** @param {SqliteDatabase} connection */
    up(connection) {
      connection.exec(`
        ALTER TABLE ai_outputs ADD COLUMN model TEXT;
        ALTER TABLE ai_outputs ADD COLUMN instructions TEXT;
        ALTER TABLE ai_outputs ADD COLUMN sources TEXT;
        ALTER TABLE ai_outputs ADD COLUMN updatedAt TEXT;
        CREATE TABLE reports (
          id TEXT NOT NULL, uid TEXT NOT NULL, title TEXT NOT NULL, brief TEXT NOT NULL,
          sections TEXT NOT NULL, status TEXT NOT NULL, provenance TEXT,
          revision INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
          validatedAt TEXT,
          PRIMARY KEY(uid, id), FOREIGN KEY(uid) REFERENCES users(uid)
        );
        CREATE TABLE report_versions (
          id TEXT NOT NULL, uid TEXT NOT NULL, reportId TEXT NOT NULL, label TEXT NOT NULL,
          title TEXT NOT NULL, sections TEXT NOT NULL, createdAt TEXT NOT NULL,
          PRIMARY KEY(uid, id),
          FOREIGN KEY(uid, reportId) REFERENCES reports(uid, id) ON DELETE CASCADE
        );
        CREATE INDEX report_versions_report ON report_versions(uid, reportId, createdAt);
      `);
    },
  },
  {
    id: 6,
    name: "skills-and-evidence",
    /** @param {SqliteDatabase} connection */
    up(connection) {
      connection.exec(`
        CREATE TABLE skills (
          id TEXT NOT NULL, uid TEXT NOT NULL, label TEXT NOT NULL, goal TEXT NOT NULL,
          level TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
          PRIMARY KEY(uid, id), FOREIGN KEY(uid) REFERENCES users(uid)
        );
        CREATE UNIQUE INDEX skills_user_label ON skills(uid, label COLLATE NOCASE);
        CREATE TABLE skill_evidence (
          uid TEXT NOT NULL, skillId TEXT NOT NULL, logId TEXT NOT NULL, createdAt TEXT NOT NULL,
          PRIMARY KEY(uid, skillId, logId),
          FOREIGN KEY(uid, skillId) REFERENCES skills(uid, id) ON DELETE CASCADE,
          FOREIGN KEY(uid, logId) REFERENCES logs(uid, id) ON DELETE CASCADE
        );
        CREATE INDEX skill_evidence_log ON skill_evidence(uid, logId);
      `);
    },
  },
  {
    id: 7,
    name: "conversations-and-simulations",
    /** @param {SqliteDatabase} connection */
    up(connection) {
      connection.exec(`
        CREATE TABLE conversations (
          id TEXT NOT NULL, uid TEXT NOT NULL, title TEXT NOT NULL,
          createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
          PRIMARY KEY(uid, id), FOREIGN KEY(uid) REFERENCES users(uid)
        );
        CREATE TABLE conversation_messages (
          id TEXT NOT NULL, uid TEXT NOT NULL, conversationId TEXT NOT NULL, position INTEGER NOT NULL,
          role TEXT NOT NULL, content TEXT NOT NULL, status TEXT NOT NULL, model TEXT, createdAt TEXT NOT NULL,
          PRIMARY KEY(uid, id),
          FOREIGN KEY(uid, conversationId) REFERENCES conversations(uid, id) ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX conversation_messages_order ON conversation_messages(uid, conversationId, position);
        CREATE TABLE simulations (
          id TEXT NOT NULL, uid TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL,
          currentStep INTEGER NOT NULL, steps TEXT NOT NULL, context TEXT NOT NULL,
          createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
          PRIMARY KEY(uid, id), FOREIGN KEY(uid) REFERENCES users(uid)
        );
      `);
    },
  },
];

/**
 * VACUUM INTO includes committed WAL data, unlike copying an open SQLite file.
 * @param {SqliteDatabase} connection
 * @param {number} fromVersion
 * @param {number} toVersion
 */
function snapshotBeforeMigration(connection, fromVersion, toVersion) {
  if (connection.name === ":memory:" || !connection.name) return null;
  const backupDirectory = path.join(path.dirname(path.resolve(connection.name)), "backups");
  mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
  const filename = `${path.basename(connection.name)}.v${fromVersion}-to-${toVersion}.${Date.now()}.${randomUUID()}.sqlite`;
  const backupPath = path.join(backupDirectory, filename);
  connection.prepare("VACUUM INTO ?").run(backupPath);
  return backupPath;
}

/** @param {SqliteDatabase} connection @param {typeof migrations} [steps] */
export function migrateDatabase(connection, steps = migrations) {
  function readHistory() {
    const hasHistory = connection
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
      .get();
    const history = hasHistory
      ? /** @type {Array<{ id: number, name: string }>} */ (
          connection.prepare("SELECT id, name FROM schema_migrations ORDER BY id").all()
        )
      : [];
    if (history.some((entry, index) => steps[index]?.id !== entry.id || steps[index]?.name !== entry.name)) {
      throw new Error(
        "Version de base incompatible. Utilise une version compatible de Stajio ou restaure une sauvegarde sur une copie.",
      );
    }
    return history;
  }
  const applied = readHistory();
  const pending = steps.slice(applied.length);
  if (!pending.length) return { version: applied.at(-1)?.id ?? 0, backupPath: null };
  const hasData = connection
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' LIMIT 1")
    .get();
  const version = pending.at(-1).id;
  const backupPath = hasData ? snapshotBeforeMigration(connection, applied.at(-1)?.id ?? 0, version) : null;
  return connection
    .transaction(() => {
      // Another Next worker may have completed the migrations while we took the
      // snapshot. Only the worker holding the write lock decides what to apply.
      const current = readHistory();
      const remaining = steps.slice(current.length);
      if (!remaining.length) return { version: current.at(-1)?.id ?? 0, backupPath: null };
      connection.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, appliedAt TEXT NOT NULL
    )`);
      const record = connection.prepare("INSERT INTO schema_migrations (id, name, appliedAt) VALUES (?, ?, ?)");
      for (const step of remaining) {
        step.up(connection);
        record.run(step.id, step.name, new Date().toISOString());
      }
      return { version, backupPath };
    })
    .immediate();
}

/** @param {string} databasePath */
export function openDatabase(databasePath) {
  if (databasePath !== ":memory:") {
    mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true, mode: 0o700 });
  }
  const connection = new Database(databasePath);
  try {
    connection.pragma("foreign_keys = ON");
    const migration = migrateDatabase(connection);
    return { connection, ...migration };
  } catch (error) {
    connection.close();
    throw error;
  }
}
