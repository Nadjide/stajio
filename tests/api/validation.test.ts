import { describe, expect, it } from "vitest";
import {
  deadlineCreateSchema,
  importSchema,
  logCreateSchema,
  profileSchema,
  registerSchema,
} from "../../src/server/validation";

describe("Validation schemas", () => {
  it("registerSchema rejects short passwords and bad emails", () => {
    expect(registerSchema.safeParse({ email: "a@b.fr", password: "1234567", displayName: "N" }).success).toBe(false);
    expect(registerSchema.safeParse({ email: "pas-un-email", password: "12345678", displayName: "N" }).success).toBe(false);
    expect(registerSchema.safeParse({ email: "a@b.fr", password: "12345678", displayName: "Nadjide" }).success).toBe(true);
  });

  it("logCreateSchema requires content and valid date", () => {
    expect(logCreateSchema.safeParse({ date: "2026-07-13", rawContent: "Semaine dense", weekNumber: 2 }).success).toBe(true);
    expect(logCreateSchema.safeParse({ date: "13/07/2026", rawContent: "x", weekNumber: 2 }).success).toBe(false);
    expect(logCreateSchema.safeParse({ date: "2026-07-13", rawContent: "", weekNumber: 2 }).success).toBe(false);
  });

  it("deadlineCreateSchema restricts type", () => {
    expect(deadlineCreateSchema.safeParse({ title: "Rendu", date: "2026-09-01", type: "school" }).success).toBe(true);
    expect(deadlineCreateSchema.safeParse({ title: "Rendu", date: "2026-09-01", type: "autre" }).success).toBe(false);
  });

  it("profileSchema requires the internship dates", () => {
    const base = {
      displayName: "Nadjide",
      school: "ESGI",
      degree: "Master",
      company: "Acme",
      internshipStart: "2026-01-05",
      internshipEnd: "2026-12-18",
    };
    expect(profileSchema.safeParse(base).success).toBe(true);
    expect(profileSchema.safeParse({ ...base, internshipStart: "" }).success).toBe(false);
  });

  it("importSchema accepts a full export payload", () => {
    const result = importSchema.safeParse({
      logs: [{ date: "2026-07-13", rawContent: "Semaine", weekNumber: 1 }],
      deadlines: [{ title: "Rendu", date: "2026-09-01", type: "school" }],
      aiOutputs: [{ type: "report", title: "Rapport", content: "# md", createdAt: "2026-07-13T10:00:00Z" }],
    });
    expect(result.success).toBe(true);
  });

  it("importSchema defaults missing collections to empty arrays", () => {
    const result = importSchema.parse({});
    expect(result.logs).toEqual([]);
    expect(result.deadlines).toEqual([]);
    expect(result.aiOutputs).toEqual([]);
  });
});
