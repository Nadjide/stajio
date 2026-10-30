import { describe, expect, it } from "vitest";
import { db } from "../../src/server/db";

describe("Test database isolation", () => {
  it("uses an in-memory database instead of the configured user file", () => {
    expect(process.env.STAJIO_DB_PATH).toBe(":memory:");
    expect(db.name).toBe(":memory:");
    const databases = db.pragma("database_list") as Array<{ name: string; file: string }>;
    expect(databases.find((database) => database.name === "main")?.file).toBe("");
  });

  it("starts with no users created by the auth or repository suites", () => {
    expect(db.prepare("SELECT COUNT(*) AS total FROM users").get()).toEqual({ total: 0 });
  });
});
