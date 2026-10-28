import { z } from "zod";
import { isCalendarDate } from "../utils/internship";

/** Shapes shared by the API and the backup format, so both accept the same content. */
export const idSchema = z.string().min(1).max(200);
export const calendarDate = z
  .string()
  .refine((value) => isCalendarDate(value), "Date calendaire valide attendue au format YYYY-MM-DD");
export const optionalCalendarDate = z.union([calendarDate, z.literal("")]);
export const timestamp = z
  .string()
  .max(40)
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
      isCalendarDate(value.slice(0, 10)) &&
      Number.isFinite(Date.parse(value)),
    "Horodatage ISO valide attendu",
  );

export const sourceSnapshotSchema = z
  .object({ id: idSchema, date: calendarDate, text: z.string().max(30_000) })
  .strict();
export const sourceSnapshotsSchema = z.array(sourceSnapshotSchema).max(2000);

export const reportBriefSchema = z
  .object({
    guidelines: z.string().max(20_000),
    problem: z.string().max(2000),
    targetLength: z.string().max(200),
    periodStart: optionalCalendarDate,
    periodEnd: optionalCalendarDate,
    sourceLogIds: z.array(idSchema).max(2000),
  })
  .strict();

export const reportSectionSchema = z
  .object({
    id: idSchema,
    title: z.string().max(200),
    intent: z.string().max(1000),
    content: z.string().max(200_000),
    generatedAt: timestamp.nullable(),
    model: z.string().max(100).nullable(),
  })
  .strict();

export const reportSectionsSchema = z
  .array(reportSectionSchema)
  .max(40)
  .superRefine((sections, context) => {
    const ids = new Set<string>();
    sections.forEach((section, index) => {
      if (ids.has(section.id)) context.addIssue({ code: "custom", path: [index, "id"], message: "Section dupliquée" });
      ids.add(section.id);
    });
  });

export const reportProvenanceSchema = z
  .object({
    model: z.string().max(100),
    generatedAt: timestamp,
    instructions: z.string().max(25_000),
    sources: sourceSnapshotsSchema,
  })
  .strict();

export const skillLevelSchema = z.enum(["to_work", "practicing", "autonomous"]);
export const skillLabelSchema = z.string().trim().min(1).max(120);

export const defenseEvaluationSchema = z
  .object({
    score: z.number().min(0).max(10),
    feedback: z.string().max(4000),
    improvedAnswer: z.string().max(6000),
  })
  .strict();

export const simulationStepSchema = z
  .object({
    question: z.string().min(1).max(1000),
    answerHint: z.string().max(2000),
    answer: z.string().max(10_000).nullable(),
    evaluation: defenseEvaluationSchema.nullable(),
  })
  .strict();

export const simulationContextSchema = z
  .object({ model: z.string().max(100), generatedAt: timestamp, sources: sourceSnapshotsSchema })
  .strict();

export const draftKeySchema = z.string().regex(/^[a-z][a-z0-9:_-]{0,99}$/i, "Clé de brouillon invalide");
export const MAX_DRAFT_LENGTH = 200_000;
