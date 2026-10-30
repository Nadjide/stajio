import { z } from "zod";
import type { BackupDocument } from "../../types/backup";
import {
  calendarDate,
  draftKeySchema,
  idSchema,
  MAX_DRAFT_LENGTH,
  reportBriefSchema,
  reportProvenanceSchema,
  reportSectionsSchema,
  simulationContextSchema,
  simulationStepSchema,
  skillLevelSchema,
  sourceSnapshotsSchema,
  timestamp,
} from "../content-schemas";

export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
// Reserve room for the request envelope and confirmation hashes. Every document
// produced by export must fit into an import request without changing its limit.
export const MAX_BACKUP_DOCUMENT_BYTES = 19 * 1024 * 1024;
const MAX_COLLECTION_ITEMS = 10_000;
const optionalProfileDate = z.union([calendarDate, z.literal(""), z.null()]);

const profileFields = {
  displayName: z.string().max(100).nullable(),
  school: z.string().max(200).nullable(),
  degree: z.string().max(200).nullable(),
  internshipStart: optionalProfileDate,
  internshipEnd: optionalProfileDate,
  company: z.string().max(200).nullable(),
  tutorName: z.string().max(200).nullable(),
};

function profileDatesAreOrdered(profile: { internshipStart?: string | null; internshipEnd?: string | null }) {
  return !profile.internshipStart || !profile.internshipEnd || profile.internshipEnd >= profile.internshipStart;
}

export const backupProfileSchema = z
  .object(profileFields)
  .strict()
  .refine(profileDatesAreOrdered, {
    message: "La fin du stage doit être postérieure ou égale à son début",
    path: ["internshipEnd"],
  });

const labels = z.array(z.string().max(500)).max(500);
const logFields = {
  id: idSchema,
  date: calendarDate,
  rawContent: z.string().min(1).max(20_000),
  structuredContent: z.string().max(20_000).nullable(),
  skills: labels,
  weekNumber: z.number().int().min(0).max(1_000_000),
  summary: z.string().max(20_000).nullable(),
  missions: labels,
  technologies: labels,
};
const deadlineFields = {
  id: idSchema,
  title: z.string().min(1).max(300),
  date: calendarDate,
  type: z.enum(["school", "company"]),
  completed: z.boolean(),
};
const outputFields = {
  id: idSchema,
  type: z.enum(["report", "defense", "cv", "chat"]),
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(1_000_000),
  createdAt: timestamp,
};
const collection = <T extends z.ZodType>(item: T) => z.array(item).max(MAX_COLLECTION_ITEMS);

const v3Collections = {
  logs: collection(z.object(logFields).strict()),
  deadlines: collection(z.object(deadlineFields).strict()),
  aiOutputs: collection(
    z
      .object({
        ...outputFields,
        updatedAt: timestamp.nullable(),
        model: z.string().max(100).nullable(),
        instructions: z.string().max(25_000).nullable(),
        sources: sourceSnapshotsSchema.nullable(),
      })
      .strict(),
  ),
  drafts: collection(
    z.object({ key: draftKeySchema, content: z.string().max(MAX_DRAFT_LENGTH), updatedAt: timestamp }).strict(),
  ),
  reports: collection(
    z
      .object({
        id: idSchema,
        title: z.string().min(1).max(200),
        brief: reportBriefSchema,
        sections: reportSectionsSchema,
        status: z.enum(["draft", "validated"]),
        provenance: reportProvenanceSchema.nullable(),
        revision: z.number().int().min(1),
        createdAt: timestamp,
        updatedAt: timestamp,
        validatedAt: timestamp.nullable(),
      })
      .strict(),
  ),
  reportVersions: collection(
    z
      .object({
        id: idSchema,
        reportId: idSchema,
        label: z.string().min(1).max(200),
        title: z.string().min(1).max(200),
        sections: reportSectionsSchema,
        createdAt: timestamp,
      })
      .strict(),
  ),
  skills: collection(
    z
      .object({
        id: idSchema,
        label: z.string().trim().min(1).max(120),
        goal: z.string().max(1000),
        level: skillLevelSchema,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .strict(),
  ),
  skillEvidence: collection(z.object({ skillId: idSchema, logId: idSchema, createdAt: timestamp }).strict()),
  conversations: collection(
    z.object({ id: idSchema, title: z.string().min(1).max(200), createdAt: timestamp, updatedAt: timestamp }).strict(),
  ),
  conversationMessages: collection(
    z
      .object({
        id: idSchema,
        conversationId: idSchema,
        position: z.number().int().min(1).max(1_000_000),
        role: z.enum(["user", "assistant"]),
        content: z.string().max(200_000),
        status: z.enum(["complete", "interrupted"]),
        model: z.string().max(100).nullable(),
        createdAt: timestamp,
      })
      .strict(),
  ),
  simulations: collection(
    z
      .object({
        id: idSchema,
        title: z.string().min(1).max(200),
        status: z.enum(["in_progress", "finished"]),
        currentStep: z.number().int().min(0).max(100),
        steps: z.array(simulationStepSchema).max(30),
        context: simulationContextSchema,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .strict(),
  ),
};

type Issue = { path: (string | number)[]; message: string };

function duplicates<T>(items: T[], key: (item: T) => string, path: (index: number) => Issue["path"], message: string) {
  const seen = new Set<string>();
  const issues: Issue[] = [];
  items.forEach((item, index) => {
    const value = key(item);
    if (seen.has(value)) issues.push({ path: path(index), message });
    seen.add(value);
  });
  return issues;
}

function missingReferences<T>(
  items: T[],
  reference: (item: T) => string,
  known: Set<string>,
  path: (index: number) => Issue["path"],
  message: string,
) {
  return items.flatMap((item, index) => (known.has(reference(item)) ? [] : [{ path: path(index), message }]));
}

/** Restoring must be able to insert every row: ids are unique and every link points to a restored row. */
function v3Consistency(raw: unknown, context: z.RefinementCtx) {
  // The project compiles without strictNullChecks, so zod's inferred keys are all optional.
  const value = raw as Omit<BackupDocument, "format" | "version" | "exportedAt" | "profile">;
  const issues: Issue[] = [];
  for (const name of [
    "logs",
    "deadlines",
    "aiOutputs",
    "reports",
    "reportVersions",
    "skills",
    "conversations",
    "conversationMessages",
    "simulations",
  ] as const) {
    issues.push(
      ...duplicates(
        value[name] as Array<{ id: string }>,
        (item) => item.id,
        (index) => [name, index, "id"],
        "Identifiant dupliqué dans la collection",
      ),
    );
  }
  issues.push(
    ...duplicates(
      value.drafts,
      (draft) => draft.key,
      (index) => ["drafts", index, "key"],
      "Brouillon dupliqué",
    ),
    // SQLite NOCASE only folds ASCII letters; mirror it exactly.
    ...duplicates(
      value.skills,
      (skill) => skill.label.replace(/[A-Z]/g, (letter) => letter.toLowerCase()),
      (index) => ["skills", index, "label"],
      "Compétence dupliquée",
    ),
    ...duplicates(
      value.skillEvidence,
      (link) => `${link.skillId}\u0000${link.logId}`,
      (index) => ["skillEvidence", index],
      "Preuve dupliquée",
    ),
    ...duplicates(
      value.conversationMessages,
      (message) => `${message.conversationId}\u0000${message.position}`,
      (index) => ["conversationMessages", index, "position"],
      "Position de message dupliquée",
    ),
  );
  const logIds = new Set(value.logs.map((log) => log.id));
  const skillIds = new Set(value.skills.map((skill) => skill.id));
  const reportIds = new Set(value.reports.map((report) => report.id));
  const conversationIds = new Set(value.conversations.map((conversation) => conversation.id));
  issues.push(
    ...missingReferences(
      value.skillEvidence,
      (link) => link.skillId,
      skillIds,
      (index) => ["skillEvidence", index, "skillId"],
      "Compétence inconnue",
    ),
    ...missingReferences(
      value.skillEvidence,
      (link) => link.logId,
      logIds,
      (index) => ["skillEvidence", index, "logId"],
      "Note inconnue",
    ),
    ...missingReferences(
      value.reportVersions,
      (version) => version.reportId,
      reportIds,
      (index) => ["reportVersions", index, "reportId"],
      "Rapport inconnu",
    ),
    ...missingReferences(
      value.conversationMessages,
      (message) => message.conversationId,
      conversationIds,
      (index) => ["conversationMessages", index, "conversationId"],
      "Conversation inconnue",
    ),
  );
  value.simulations.forEach((simulation, index) => {
    if (simulation.currentStep > simulation.steps.length) {
      issues.push({ path: ["simulations", index, "currentStep"], message: "Étape hors de la simulation" });
    }
  });
  for (const issue of issues) context.addIssue({ code: "custom", ...issue });
}

export const backupV3Schema = z
  .object({
    format: z.literal("stajio"),
    version: z.literal(3),
    exportedAt: timestamp,
    profile: backupProfileSchema,
    ...v3Collections,
  })
  .strict()
  .superRefine(v3Consistency);

const legacyCollectionNames = ["logs", "deadlines", "aiOutputs"] as const;
function uniqueLegacyIds(
  value: { logs: Array<{ id: string }>; deadlines: Array<{ id: string }>; aiOutputs: Array<{ id: string }> },
  context: z.RefinementCtx,
) {
  for (const name of legacyCollectionNames) {
    for (const issue of duplicates(
      value[name],
      (item) => item.id,
      (index) => [name, index, "id"],
      "Identifiant dupliqué dans la collection",
    )) {
      context.addIssue({ code: "custom", ...issue });
    }
  }
}

const backupV2Schema = z
  .object({
    format: z.literal("stajio"),
    version: z.literal(2),
    exportedAt: timestamp,
    profile: backupProfileSchema,
    logs: collection(z.object(logFields).strict()),
    deadlines: collection(z.object(deadlineFields).strict()),
    aiOutputs: collection(z.object(outputFields).strict()),
  })
  .strict()
  .superRefine(uniqueLegacyIds);

// Only the complete version-1 documents produced by Stajio are accepted. The
// previous ad-hoc partial imports cannot describe a safe replacement operation.
const legacyProfile = z
  .object({ uid: idSchema, email: z.string().email(), ...profileFields })
  .strict()
  .refine(profileDatesAreOrdered, { message: "Dates de stage incohérentes", path: ["internshipEnd"] });
const legacyV1Schema = z
  .object({
    version: z.literal(1),
    exportedAt: timestamp,
    profile: legacyProfile,
    logs: collection(z.object({ ...logFields, uid: idSchema }).strict()),
    deadlines: collection(z.object({ ...deadlineFields, uid: idSchema }).strict()),
    aiOutputs: collection(z.object({ ...outputFields, uid: idSchema }).strict()),
  })
  .strict()
  .superRefine((value, context) => {
    uniqueLegacyIds(value, context);
    for (const name of legacyCollectionNames) {
      for (const [index, record] of value[name].entries()) {
        if (record.uid !== value.profile.uid) {
          context.addIssue({
            code: "custom",
            path: [name, index, "uid"],
            message: "La sauvegarde mélange plusieurs comptes",
          });
        }
      }
    }
  });

export class BackupError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: string[],
  ) {
    super(message);
    this.name = "BackupError";
  }
}

function invalidBackup(error: z.ZodError): never {
  throw new BackupError(
    "Sauvegarde invalide ou incomplète. Aucun changement n'a été effectué.",
    400,
    error.issues.slice(0, 20).map((issue) => `${issue.path.join(".") || "backup"}: ${issue.message}`),
  );
}

export function assertBackupSize(backup: BackupDocument): BackupDocument {
  if (Buffer.byteLength(JSON.stringify(backup), "utf8") > MAX_BACKUP_DOCUMENT_BYTES) {
    throw new BackupError(
      "La sauvegarde dépasse la limite de 19 Mio pour un document JSON. Aucun changement n'a été effectué.",
      413,
    );
  }
  return backup;
}

type LegacyData = {
  exportedAt: string;
  profile: BackupDocument["profile"];
  logs: BackupDocument["logs"];
  deadlines: BackupDocument["deadlines"];
  aiOutputs: Array<Omit<BackupDocument["aiOutputs"][number], "updatedAt" | "model" | "instructions" | "sources">>;
};

/** Older formats could not contain the newer collections, so they are genuinely empty. */
function upgradeLegacy(data: LegacyData): BackupDocument {
  return {
    format: "stajio",
    version: 3,
    exportedAt: data.exportedAt,
    profile: data.profile,
    logs: data.logs,
    deadlines: data.deadlines,
    aiOutputs: data.aiOutputs.map((output) => ({
      ...output,
      updatedAt: null,
      model: null,
      instructions: null,
      sources: null,
    })),
    drafts: [],
    reports: [],
    reportVersions: [],
    skills: [],
    skillEvidence: [],
    conversations: [],
    conversationMessages: [],
    simulations: [],
  };
}

export function decodeBackup(raw: unknown): { backup: BackupDocument; sourceVersion: 1 | 2 | 3 } {
  if (
    !raw ||
    typeof raw !== "object" ||
    !("version" in raw) ||
    (raw.version !== 1 && raw.version !== 2 && raw.version !== 3)
  ) {
    throw new BackupError("Version de sauvegarde absente ou incompatible. Utilise un export complet de Stajio.", 400);
  }
  if (raw.version === 3) {
    const parsed = backupV3Schema.safeParse(raw);
    if (!parsed.success) invalidBackup(parsed.error);
    return { backup: assertBackupSize(parsed.data as BackupDocument), sourceVersion: 3 };
  }
  if (raw.version === 2) {
    const parsed = backupV2Schema.safeParse(raw);
    if (!parsed.success) invalidBackup(parsed.error);
    return { backup: assertBackupSize(upgradeLegacy(parsed.data as LegacyData)), sourceVersion: 2 };
  }
  const parsed = legacyV1Schema.safeParse(raw);
  if (!parsed.success) invalidBackup(parsed.error);
  const { uid: _uid, email: _email, ...profile } = parsed.data.profile;
  const stripOwner = <T extends { uid: string }>(record: T) => {
    const { uid: _owner, ...data } = record;
    return data;
  };
  return {
    sourceVersion: 1,
    backup: assertBackupSize(
      upgradeLegacy({
        exportedAt: parsed.data.exportedAt,
        profile,
        logs: parsed.data.logs.map(stripOwner),
        deadlines: parsed.data.deadlines.map(stripOwner),
        aiOutputs: parsed.data.aiOutputs.map(stripOwner),
      } as LegacyData),
    ),
  };
}

/** Shared validation entry point; missing collections never become empty arrays. */
export const importSchema = z.unknown().transform((value, context) => {
  try {
    return decodeBackup(value).backup;
  } catch (error) {
    if (!(error instanceof BackupError)) throw error;
    context.addIssue({ code: "custom", message: [error.message, ...(error.details || [])].join(" ") });
    return z.NEVER;
  }
});
