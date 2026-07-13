import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/server/db";
import { logsRepository } from "../../src/server/repositories/logs";
import { deadlinesRepository } from "../../src/server/repositories/deadlines";
import { aiOutputsRepository } from "../../src/server/repositories/ai-outputs";

const TEST_UID = "test-repo-uid";
const OTHER_UID = "test-repo-other-uid";

function cleanup() {
  db.prepare("DELETE FROM logs WHERE uid IN (?, ?)").run(TEST_UID, OTHER_UID);
  db.prepare("DELETE FROM deadlines WHERE uid IN (?, ?)").run(TEST_UID, OTHER_UID);
  db.prepare("DELETE FROM ai_outputs WHERE uid IN (?, ?)").run(TEST_UID, OTHER_UID);
}

describe("Repositories", () => {
  beforeAll(() => {
    const insertUser = db.prepare(
      "INSERT OR IGNORE INTO users (uid, email, displayName, password) VALUES (?, ?, ?, ?)",
    );
    insertUser.run(TEST_UID, "test-repo@stajio.dev", "Test Repo", "hash");
    insertUser.run(OTHER_UID, "test-repo-other@stajio.dev", "Test Repo Other", "hash");
  });

  beforeEach(cleanup);

  afterAll(() => {
    cleanup();
    db.prepare("DELETE FROM users WHERE uid IN (?, ?)").run(TEST_UID, OTHER_UID);
  });

  describe("logsRepository", () => {
    it("updates an existing log", () => {
      logsRepository.add("log-1", TEST_UID, {
        date: "2026-07-01",
        rawContent: "Contenu initial",
        structuredContent: "Résumé initial",
        skills: ["React"],
        weekNumber: 3,
        summary: "Résumé initial",
        missions: ["Mission A"],
        technologies: ["Next.js"],
      });

      const updated = logsRepository.updateByIdAndUid("log-1", TEST_UID, {
        rawContent: "Contenu modifié",
        summary: "Nouveau résumé",
        technologies: ["Next.js", "SQLite"],
      });
      expect(updated).toBe(true);

      const logs = logsRepository.listByUid(TEST_UID);
      expect(logs).toHaveLength(1);
      expect(logs[0].rawContent).toBe("Contenu modifié");
      expect(logs[0].summary).toBe("Nouveau résumé");
      expect(logs[0].technologies).toEqual(["Next.js", "SQLite"]);
      // Les champs non fournis sont conservés
      expect(logs[0].skills).toEqual(["React"]);
      expect(logs[0].weekNumber).toBe(3);
    });

    it("does not update a log belonging to another user", () => {
      logsRepository.add("log-2", OTHER_UID, {
        date: "2026-07-01",
        rawContent: "Privé",
        structuredContent: "Privé",
        weekNumber: 1,
      });

      const updated = logsRepository.updateByIdAndUid("log-2", TEST_UID, { rawContent: "Piraté" });
      expect(updated).toBe(false);

      const logs = logsRepository.listByUid(OTHER_UID);
      expect(logs[0].rawContent).toBe("Privé");
    });
  });

  describe("deadlinesRepository", () => {
    it("updates title, date, type and completed", () => {
      deadlinesRepository.add("dl-1", TEST_UID, {
        title: "Rendu rapport",
        date: "2026-08-01",
        type: "school",
        completed: false,
      });

      const updated = deadlinesRepository.updateByIdAndUid("dl-1", TEST_UID, {
        title: "Rendu rapport final",
        type: "company",
        completed: true,
      });
      expect(updated).toBe(true);

      const deadlines = deadlinesRepository.listByUid(TEST_UID);
      expect(deadlines[0].title).toBe("Rendu rapport final");
      expect(deadlines[0].type).toBe("company");
      expect(deadlines[0].completed).toBe(true);
      expect(deadlines[0].date).toBe("2026-08-01");
    });

    it("returns false for a deadline of another user", () => {
      deadlinesRepository.add("dl-2", OTHER_UID, {
        title: "Privé",
        date: "2026-08-01",
        type: "school",
      });
      expect(deadlinesRepository.updateByIdAndUid("dl-2", TEST_UID, { completed: true })).toBe(false);
    });
  });

  describe("aiOutputsRepository", () => {
    it("adds, lists and deletes outputs scoped by user", () => {
      aiOutputsRepository.add("out-1", TEST_UID, {
        type: "report",
        title: "Rapport du 13 juillet",
        content: "# Mon rapport",
      });
      aiOutputsRepository.add("out-2", OTHER_UID, {
        type: "cv",
        title: "CV",
        content: "- Point",
      });

      const outputs = aiOutputsRepository.listByUid(TEST_UID);
      expect(outputs).toHaveLength(1);
      expect(outputs[0].title).toBe("Rapport du 13 juillet");
      expect(outputs[0].createdAt).toBeTruthy();

      // Suppression cross-user sans effet
      aiOutputsRepository.deleteByIdAndUid("out-2", TEST_UID);
      expect(aiOutputsRepository.listByUid(OTHER_UID)).toHaveLength(1);

      aiOutputsRepository.deleteByIdAndUid("out-1", TEST_UID);
      expect(aiOutputsRepository.listByUid(TEST_UID)).toHaveLength(0);
    });
  });
});
