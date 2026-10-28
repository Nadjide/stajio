import bcrypt from "bcryptjs";
import type { AuthPayload } from "./auth";
import { db } from "./db";
import { deleteAccountContent } from "./account-content";
import {
  AccountError,
  assertCurrentCredentials,
  commitPasswordChange,
  hashNewPassword,
  readCredentials,
} from "./account-credentials.mjs";

async function verifyCurrentPassword(auth: AuthPayload, password: string) {
  const expected = readCredentials(db, auth.uid);
  if (!expected || expected.authVersion !== auth.authVersion) {
    throw new AccountError("Le compte ou sa session a changé. Reconnecte-toi avant de réessayer.", 409);
  }
  if (!(await bcrypt.compare(password, expected.password))) {
    throw new AccountError("Le mot de passe actuel est incorrect.", 403);
  }
  return expected;
}

export async function changeAccountPassword(auth: AuthPayload, currentPassword: string, newPassword: string) {
  const expected = await verifyCurrentPassword(auth, currentPassword);
  const hashedPassword = await hashNewPassword(newPassword);
  return commitPasswordChange(db, expected, hashedPassword);
}

export async function deleteAccountData(auth: AuthPayload, currentPassword: string, scope: "data" | "account") {
  const expected = await verifyCurrentPassword(auth, currentPassword);
  return db
    .transaction(() => {
      assertCurrentCredentials(db, expected);
      deleteAccountContent(auth.uid);
      if (scope === "account") {
        db.prepare("DELETE FROM users WHERE uid = ?").run(auth.uid);
        return null;
      }
      db.prepare(
        `UPDATE users SET school = NULL, degree = NULL, internshipStart = NULL,
      internshipEnd = NULL, company = NULL, tutorName = NULL, authVersion = authVersion + 1
      WHERE uid = ?`,
      ).run(auth.uid);
      return { uid: expected.uid, email: expected.email, authVersion: expected.authVersion + 1 };
    })
    .immediate();
}
