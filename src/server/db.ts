import path from "node:path";
import type { Database } from "better-sqlite3";
import { openDatabase } from "./database.mjs";

const DB_PATH = process.env.STAJIO_DB_PATH || path.join(process.cwd(), "stajio.db");

let connection: Database | null = null;

/**
 * Opened on first use, not on import: `next build` imports every route module
 * and must never open (and migrate) the user's database.
 */
export const db = new Proxy({} as Database, {
  get(_target, property) {
    connection ??= openDatabase(DB_PATH).connection;
    const value = Reflect.get(connection, property, connection);
    return typeof value === "function" ? value.bind(connection) : value;
  },
});
