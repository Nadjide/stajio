import { Buffer } from "node:buffer";
import bcrypt from "bcryptjs";

/** @typedef {import('better-sqlite3').Database} SqliteDatabase */
/** @typedef {{uid: string, email: string, password: string, authVersion: number}} CredentialSnapshot */

export const PASSWORD_REQUIREMENT =
  "Le nouveau mot de passe doit contenir au moins 8 caractères et au plus 72 octets UTF-8.";

export function isValidNewPassword(value) {
  return typeof value === "string" && value.length >= 8 && Buffer.byteLength(value, "utf8") <= 72;
}

export class AccountError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "AccountError";
    this.status = status;
  }
}

/** @param {SqliteDatabase} connection @param {string} uid */
export function readCredentials(connection, uid) {
  return /** @type {CredentialSnapshot | undefined} */ (
    connection.prepare("SELECT uid, email, password, authVersion FROM users WHERE uid = ?").get(uid)
  );
}

/** Check again under the write lock, after asynchronous password verification. */
export function assertCurrentCredentials(connection, expected) {
  const current = readCredentials(connection, expected.uid);
  if (
    !current ||
    current.password !== expected.password ||
    current.authVersion !== expected.authVersion ||
    current.email !== expected.email
  ) {
    throw new AccountError("Le compte ou sa session a changé. Reconnecte-toi avant de réessayer.", 409);
  }
  return current;
}

export async function hashNewPassword(password) {
  if (!isValidNewPassword(password)) throw new AccountError(PASSWORD_REQUIREMENT);
  return bcrypt.hash(password, 10);
}

/** @param {SqliteDatabase} connection @param {CredentialSnapshot} expected @param {string} hashedPassword */
export function commitPasswordChange(connection, expected, hashedPassword) {
  return connection
    .transaction(() => {
      assertCurrentCredentials(connection, expected);
      connection
        .prepare("UPDATE users SET password = ?, authVersion = authVersion + 1 WHERE uid = ?")
        .run(hashedPassword, expected.uid);
      return { uid: expected.uid, email: expected.email, authVersion: expected.authVersion + 1 };
    })
    .immediate();
}
