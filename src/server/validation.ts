import { NextResponse } from "next/server";
import { z } from "zod";
import { isCalendarDate } from "../utils/internship";
import { newPasswordSchema } from "./account-validation";
import {
  MAX_DRAFT_LENGTH,
  reportBriefSchema,
  reportProvenanceSchema,
  reportSectionsSchema,
  skillLabelSchema,
  skillLevelSchema,
  sourceSnapshotsSchema,
} from "./content-schemas";

export const isoDate = z.string().refine(isCalendarDate, "Date calendaire valide attendue au format YYYY-MM-DD");

export const registerSchema = z.object({
  email: z.string().email(),
  password: newPasswordSchema,
  displayName: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const profileSchema = z
  .object({
    displayName: z.string().min(1).max(100),
    school: z.string().min(1).max(200),
    degree: z.string().min(1).max(200),
    internshipStart: isoDate,
    internshipEnd: isoDate,
    company: z.string().min(1).max(200),
    tutorName: z.string().max(200).optional().default(""),
  })
  .refine((profile) => profile.internshipEnd >= profile.internshipStart, {
    message: "La fin du stage doit être postérieure ou égale à son début",
    path: ["internshipEnd"],
  });

export const logCreateSchema = z.object({
  id: z.string().optional(),
  date: isoDate,
  rawContent: z.string().min(1).max(20000),
  structuredContent: z.string().max(20000).optional().default(""),
  skills: z.array(z.string()).optional().default([]),
  // Accepted for existing clients/exports, but API routes calculate it themselves.
  weekNumber: z.number().int().min(0).default(0),
  summary: z.string().max(20000).optional(),
  missions: z.array(z.string()).optional().default([]),
  technologies: z.array(z.string()).optional().default([]),
});

export const logUpdateSchema = z.object({
  date: isoDate.optional(),
  rawContent: z.string().min(1).max(20000).optional(),
  structuredContent: z.string().max(20000).optional(),
  skills: z.array(z.string()).optional(),
  weekNumber: z.number().int().min(0).optional(),
  summary: z.string().max(20000).optional(),
  missions: z.array(z.string()).optional(),
  technologies: z.array(z.string()).optional(),
});

export const deadlineCreateSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(300),
  date: isoDate,
  type: z.enum(["school", "company"]),
  completed: z.boolean().optional().default(false),
});

export const deadlineUpdateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  date: isoDate.optional(),
  type: z.enum(["school", "company"]).optional(),
  completed: z.boolean().optional(),
});

export const aiOutputCreateSchema = z.object({
  type: z.enum(["report", "defense", "cv", "chat"]),
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(1_000_000),
  model: z.string().max(100).nullable().optional(),
  instructions: z.string().max(25_000).nullable().optional(),
  sources: sourceSnapshotsSchema.nullable().optional(),
});

export const aiOutputUpdateSchema = z
  .object({ title: z.string().min(1).max(300).optional(), content: z.string().min(1).max(1_000_000).optional() })
  .strict();

export const onboardingSchema = z
  .object({
    profile: profileSchema,
    deadlines: z
      .array(
        z
          .object({ title: z.string().trim().min(1).max(300), date: isoDate, type: z.enum(["school", "company"]) })
          .strict(),
      )
      .max(10),
  })
  .strict();

export const draftSaveSchema = z.object({ content: z.string().max(MAX_DRAFT_LENGTH) }).strict();

export const reportCreateSchema = z.object({ title: z.string().trim().min(1).max(200).optional() }).strict();

export const reportUpdateSchema = z
  .object({
    revision: z.number().int().min(1),
    title: z.string().trim().min(1).max(200),
    brief: reportBriefSchema,
    sections: reportSectionsSchema,
    status: z.enum(["draft", "validated"]),
    provenance: reportProvenanceSchema.nullable().optional(),
  })
  .strict();

export const reportVersionCreateSchema = z.object({ label: z.string().trim().min(1).max(200) }).strict();
export const reportRestoreSchema = z.object({ revision: z.number().int().min(1) }).strict();

const evidenceIds = z.array(z.string().min(1).max(200)).max(2000);

export const skillCreateSchema = z
  .object({
    label: skillLabelSchema,
    goal: z.string().trim().max(1000).optional().default(""),
    level: skillLevelSchema.optional().default("to_work"),
    logIds: evidenceIds.optional().default([]),
  })
  .strict();

export const skillUpdateSchema = z
  .object({
    label: skillLabelSchema.optional(),
    goal: z.string().trim().max(1000).optional(),
    level: skillLevelSchema.optional(),
    logIds: evidenceIds.optional(),
  })
  .strict();

export const skillMergeSchema = z
  .object({ sourceId: z.string().min(1).max(200), targetId: z.string().min(1).max(200) })
  .strict();

export const conversationCreateSchema = z.object({ title: z.string().trim().min(1).max(200).optional() }).strict();
export const conversationRenameSchema = z.object({ title: z.string().trim().min(1).max(200) }).strict();

export const conversationMessageSchema = z
  .object({
    content: z.string().trim().min(1).max(10_000).optional(),
    clientMessageId: z
      .string()
      .regex(/^[a-zA-Z0-9-]{8,100}$/)
      .optional(),
    retry: z.boolean().optional(),
    model: z.string().trim().max(100).optional(),
  })
  .strict()
  .refine((body) => !!body.content !== !!body.retry, {
    message: "Envoie soit un message, soit une demande de relance",
  });

export const simulationCreateSchema = z
  .object({
    model: z.string().trim().max(100).optional(),
    logIds: z.array(z.string().min(1).max(200)).max(2000).optional(),
  })
  .strict();

export const simulationUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    currentStep: z.number().int().min(0).max(100).optional(),
    status: z.enum(["in_progress", "finished"]).optional(),
  })
  .strict();

export const simulationAnswerSchema = z
  .object({
    index: z.number().int().min(0).max(100),
    answer: z.string().trim().min(1).max(10_000),
    model: z.string().trim().max(100).optional(),
  })
  .strict();

export { importSchema } from "./backup/schemas";

type ParseResult<T> = { data: T; error?: never } | { data?: never; error: NextResponse };

export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<ParseResult<z.infer<S>>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { error: NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 }) };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`);
    return { error: NextResponse.json({ error: "Validation échouée", details }, { status: 400 }) };
  }
  return { data: result.data };
}
