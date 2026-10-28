import Database from "better-sqlite3";
import path from "node:path";
import { migrateDatabase } from "./database.mjs";
import {
  AccountError,
  commitPasswordChange,
  hashNewPassword,
  isValidNewPassword,
  PASSWORD_REQUIREMENT,
  readCredentials,
} from "./account-credentials.mjs";

const requiredColumns = {
  users: [
    "uid",
    "email",
    "password",
    "displayName",
    "school",
    "degree",
    "internshipStart",
    "internshipEnd",
    "company",
    "tutorName",
  ],
  logs: [
    "id",
    "uid",
    "date",
    "rawContent",
    "structuredContent",
    "skills",
    "weekNumber",
    "summary",
    "missions",
    "technologies",
  ],
  deadlines: ["id", "uid", "title", "date", "type", "completed"],
  ai_outputs: ["id", "uid", "type", "title", "content", "createdAt"],
};

/** Recognition happens before migration or any other write. */
export function assertStajioDatabase(connection) {
  for (const [table, columns] of Object.entries(requiredColumns)) {
    const found = new Set(
      connection
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .map((column) => column.name),
    );
    if (!columns.every((column) => found.has(column))) {
      throw new AccountError(
        "Ce fichier n'est pas une base Stajio reconnue. Aucune réinitialisation n'a été effectuée.",
      );
    }
  }
  if (connection.pragma("integrity_check", { simple: true }) !== "ok") {
    throw new AccountError("La base SQLite est endommagée. Récupère d'abord une sauvegarde sur une copie.");
  }
}

export function inspectRecoveryTarget(databasePath, email) {
  if (!databasePath || databasePath === ":memory:")
    throw new AccountError("Indique explicitement le chemin d'une base Stajio existante.");
  const resolvedPath = path.resolve(databasePath);
  const connection = new Database(resolvedPath, { readonly: true, fileMustExist: true });
  try {
    assertStajioDatabase(connection);
    if (!connection.prepare("SELECT uid FROM users WHERE email = ?").get(email)) {
      throw new AccountError("Aucun compte ne correspond à cette adresse dans la base sélectionnée.");
    }
    return resolvedPath;
  } finally {
    connection.close();
  }
}

export async function resetLocalPassword(databasePath, email, password) {
  if (!isValidNewPassword(password)) throw new AccountError(PASSWORD_REQUIREMENT);
  const resolvedPath = inspectRecoveryTarget(databasePath, email);
  // fileMustExist also prevents recreation if the file disappears between checks.
  const connection = new Database(resolvedPath, { fileMustExist: true });
  try {
    assertStajioDatabase(connection);
    if (!connection.prepare("SELECT uid FROM users WHERE email = ?").get(email)) {
      throw new AccountError("Le compte sélectionné n'existe plus.", 409);
    }
    connection.pragma("foreign_keys = ON");
    const migration = migrateDatabase(connection);
    const account = connection.prepare("SELECT uid FROM users WHERE email = ?").get(email);
    const expected = account && readCredentials(connection, account.uid);
    if (!expected) throw new AccountError("Le compte sélectionné n'existe plus.", 409);
    const hash = await hashNewPassword(password);
    commitPasswordChange(connection, expected, hash);
    return { databasePath: resolvedPath, backupPath: migration.backupPath };
  } finally {
    connection.close();
  }
}
