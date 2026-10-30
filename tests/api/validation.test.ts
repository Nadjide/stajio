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
    expect(registerSchema.safeParse({ email: "pas-un-email", password: "12345678", displayName: "N" }).success).toBe(
      false,
    );
    expect(registerSchema.safeParse({ email: "a@b.fr", password: "12345678", displayName: "Nadjide" }).success).toBe(
      true,
    );
  });

  it("logCreateSchema requires content and valid date", () => {
    expect(logCreateSchema.safeParse({ date: "2026-07-13", rawContent: "Semaine dense", weekNumber: 2 }).success).toBe(
      true,
    );
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
    expect(profileSchema.safeParse({ ...base, internshipStart: "2026-02-30" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, internshipEnd: "2025-12-31" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, internshipEnd: base.internshipStart }).success).toBe(true);
  });

  it("validates real calendar dates for deadlines and logs", () => {
    expect(deadlineCreateSchema.safeParse({ title: "Rendu", date: "2026-04-31", type: "school" }).success).toBe(false);
    expect(logCreateSchema.safeParse({ date: "2026-02-29", rawContent: "Note" }).success).toBe(false);
    expect(logCreateSchema.safeParse({ date: "2024-02-29", rawContent: "Note" }).success).toBe(true);
    expect(logCreateSchema.safeParse({ date: "2026-10-27", rawContent: "Note", weekNumber: -1 }).success).toBe(false);
  });

  it("importSchema requires a complete versioned export payload", () => {
    const result = importSchema.safeParse({
      format: "stajio",
      version: 2,
      exportedAt: "2026-10-27T12:00:00Z",
      profile: {
        displayName: "Étudiant",
        school: null,
        degree: null,
        internshipStart: null,
        internshipEnd: null,
        company: null,
        tutorName: null,
      },
      logs: [],
      deadlines: [],
      aiOutputs: [],
    });
    expect(result.success).toBe(true);
  });

  it("importSchema rejects partial imports instead of replacing missing collections with empty arrays", () => {
    expect(importSchema.safeParse({}).success).toBe(false);
    expect(importSchema.safeParse({ logs: [], deadlines: [], aiOutputs: [] }).success).toBe(false);
  });
});
