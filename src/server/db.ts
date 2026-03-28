import path from "path";
import Database from "better-sqlite3";

const DB_PATH = path.join(process.cwd(), "stajio.db");

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    uid TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    displayName TEXT,
    school TEXT,
    degree TEXT,
    internshipStart TEXT,
    internshipEnd TEXT,
    company TEXT,
    tutorName TEXT,
    password TEXT
  );

  CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    uid TEXT,
    date TEXT,
    rawContent TEXT,
    structuredContent TEXT,
    skills TEXT,
    weekNumber INTEGER,
    summary TEXT,
    missions TEXT,
    technologies TEXT,
    FOREIGN KEY(uid) REFERENCES users(uid)
  );

  CREATE TABLE IF NOT EXISTS deadlines (
    id TEXT PRIMARY KEY,
    uid TEXT,
    title TEXT,
    date TEXT,
    type TEXT,
    completed INTEGER,
    FOREIGN KEY(uid) REFERENCES users(uid)
  );
`);

export { db };
