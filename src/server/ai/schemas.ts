import { z } from "zod";

const modelName = z.string().trim().max(100).optional();
const logIds = z.array(z.string().min(1).max(200)).max(2000).optional();
const idSchema = z.string().min(1).max(200);

/** Models often omit empty arrays or pad labels; keep only non-empty, deduplicated strings. */
const labelList = (maxItems: number) =>
  z
    .array(z.unknown())
    .optional()
    .default([])
    .transform((items) => [
      ...new Set(
        items
          .filter((item): item is string | number => typeof item === "string" || typeof item === "number")
          .map((item) => String(item).trim().slice(0, 200))
          .filter(Boolean),
      ),
    ])
    .pipe(z.array(z.string()).max(maxItems));

const text = (max: number) => z.string().trim().min(1).max(max);

// --- Outputs ------------------------------------------------------------

export const structureLogOutput = z.object({
  summary: text(5000),
  missions: labelList(30),
  technologies: labelList(30),
  skills: labelList(30),
});

export const defensePrepOutput = z.object({
  plan: z.array(text(500)).min(1).max(20),
  questions: z
    .array(z.object({ question: text(1000), answerHint: z.string().trim().max(2000).default("") }))
    .min(1)
    .max(15),
});

export const evaluationOutput = z.object({
  score: z
    .union([
      z.number(),
      z
        .string()
        .trim()
        .regex(/^\d+(?:[.,]\d+)?$/)
        .transform((value) => Number(value.replace(",", "."))),
    ])
    .pipe(z.number().min(0).max(10)),
  feedback: text(4000),
  improvedAnswer: z.string().trim().max(6000).default(""),
});

export const reportPlanOutput = z.object({
  sections: z
    .array(z.object({ title: text(200), intent: z.string().trim().max(1000).default("") }))
    .min(2)
    .max(15),
});

// --- Inputs -------------------------------------------------------------

export const aiRequestSchema = z.discriminatedUnion("task", [
  z.object({
    task: z.literal("structureLog"),
    model: modelName,
    payload: z.object({ rawContent: text(20_000) }),
  }),
  z.object({
    task: z.literal("prepareDefense"),
    model: modelName,
    payload: z.object({ logIds }).optional().default({}),
  }),
  z.object({
    task: z.literal("reportPlan"),
    model: modelName,
    payload: z.object({ reportId: idSchema }),
  }),
]);

export const aiStreamRequestSchema = z.discriminatedUnion("task", [
  z.object({
    task: z.literal("generateCVPoints"),
    model: modelName,
    payload: z.object({ logIds: z.array(idSchema).min(1).max(2000) }),
  }),
  z.object({
    task: z.literal("reportSection"),
    model: modelName,
    payload: z.object({ reportId: idSchema, sectionId: idSchema }),
  }),
]);

export const aiEstimateSchema = z.discriminatedUnion("task", [
  z.object({ task: z.literal("report"), reportId: idSchema, logIds }),
  z.object({ task: z.literal("cv"), logIds }),
  z.object({ task: z.literal("defense"), logIds }),
  z.object({ task: z.literal("chat") }),
]);
