import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/server/db";
import { ACCOUNT_CONTENT_TABLES } from "../../src/server/account-content";
import { exportAccount, previewRestore, restoreAccount } from "../../src/server/backup/service";
import { getInternshipWeek } from "../../src/utils/internship";

const fixture = JSON.parse(readFileSync("docs/fixtures/demo-backup.json", "utf8"));

beforeEach(() => {
  db.exec(`${ACCOUNT_CONTENT_TABLES.map((table) => `DELETE FROM ${table};`).join(" ")} DELETE FROM users;`);
  db.prepare("INSERT INTO users (uid, email, password) VALUES ('recette', 'recette@example.test', 'hash')").run();
});

describe("Fictional acceptance dataset", () => {
  it("is a valid current backup spanning several months, restorable twice without duplicates", () => {
    expect(fixture.version).toBe(3);
    const months = new Set(fixture.logs.map((log: { date: string }) => log.date.slice(0, 7)));
    expect(months.size).toBeGreaterThanOrEqual(5);
    for (const log of fixture.logs) {
      expect(log.weekNumber).toBe(getInternshipWeek(log.date, fixture.profile.internshipStart));
    }
    restoreAccount("recette", fixture, previewRestore("recette", fixture));
    const first = exportAccount("recette");
    restoreAccount("recette", fixture, previewRestore("recette", fixture));
    const { exportedAt: _a, ...again } = exportAccount("recette");
    const { exportedAt: _b, ...initial } = first;
    expect(again).toEqual(initial);
    expect(initial.skillEvidence).toHaveLength(fixture.skillEvidence.length);
  });
});
