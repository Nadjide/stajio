import { db } from "../db";

type UserRow = {
  uid: string;
  email: string;
  displayName: string;
  school: string;
  degree: string;
  internshipStart: string;
  internshipEnd: string;
  company: string;
  tutorName: string;
  password: string;
};

export const usersRepository = {
  create: (uid: string, email: string, hashedPassword: string, displayName: string) => {
    const stmt = db.prepare("INSERT INTO users (uid, email, password, displayName) VALUES (?, ?, ?, ?)");
    stmt.run(uid, email, hashedPassword, displayName);
  },

  findByEmail: (email: string) => {
    return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
  },

  findPublicByUid: (uid: string) => {
    return db.prepare("SELECT uid, email, displayName FROM users WHERE uid = ?").get(uid) as Pick<UserRow, "uid" | "email" | "displayName"> | undefined;
  },

  findProfileByUid: (uid: string) => {
    return db
      .prepare(
        "SELECT uid, email, displayName, school, degree, internshipStart, internshipEnd, company, tutorName FROM users WHERE uid = ?",
      )
      .get(uid) as Omit<UserRow, "password"> | undefined;
  },

  updateProfile: (
    uid: string,
    payload: {
      school?: string;
      degree?: string;
      internshipStart?: string;
      internshipEnd?: string;
      company?: string;
      tutorName?: string;
      displayName?: string;
    },
  ) => {
    const { school, degree, internshipStart, internshipEnd, company, tutorName, displayName } = payload;
    const stmt = db.prepare(`
      UPDATE users
      SET school = ?, degree = ?, internshipStart = ?, internshipEnd = ?, company = ?, tutorName = ?, displayName = ?
      WHERE uid = ?
    `);
    stmt.run(school, degree, internshipStart, internshipEnd, company, tutorName, displayName, uid);
  },
};
