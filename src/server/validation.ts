import { NextResponse } from "next/server";
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format YYYY-MM-DD");

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Mot de passe: 8 caractères minimum"),
  displayName: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const profileSchema = z.object({
  displayName: z.string().min(1).max(100),
  school: z.string().min(1).max(200),
  degree: z.string().min(1).max(200),
  internshipStart: isoDate,
  internshipEnd: isoDate,
  company: z.string().min(1).max(200),
  tutorName: z.string().max(200).optional().default(""),
});

export const logCreateSchema = z.object({
  id: z.string().optional(),
  date: isoDate,
  rawContent: z.string().min(1).max(20000),
  structuredContent: z.string().max(20000).optional().default(""),
  skills: z.array(z.string()).optional().default([]),
  weekNumber: z.number().int().min(0),
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

export const aiRequestSchema = z.object({
  task: z.enum([
    "structureLog",
    "generateReport",
    "prepareDefense",
    "generateCVPoints",
    "chat",
    "evaluateAnswer",
  ]),
  model: z.string().max(100).optional(),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});

export const aiStreamRequestSchema = z.object({
  task: z.enum(["generateReport", "generateCVPoints", "chat"]),
  model: z.string().max(100).optional(),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});

export const aiOutputCreateSchema = z.object({
  type: z.enum(["report", "defense", "cv", "chat"]),
  title: z.string().min(1).max(300),
  content: z.string().min(1),
});

export const importSchema = z.object({
  logs: z.array(logCreateSchema).optional().default([]),
  deadlines: z.array(deadlineCreateSchema).optional().default([]),
  aiOutputs: z
    .array(
      aiOutputCreateSchema.extend({
        createdAt: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
});

type ParseResult<T> = { data: T; error?: never } | { data?: never; error: NextResponse };

export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<ParseResult<z.infer<S>>> {
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
