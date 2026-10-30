import type { LogEntry } from "../../types/models";

export type StructuredFields = { summary: string; missions: string; technologies: string; skills: string };

export const toLines = (values: string[] | undefined) => (values ?? []).join("\n");
export const toCommaList = (values: string[] | undefined) => (values ?? []).join(", ");

export function parseLines(value: string): string[] {
  return [
    ...new Set(
      value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export function parseList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export function fieldsFromLog(log: LogEntry): StructuredFields {
  return {
    summary: log.summary || "",
    missions: toLines(log.missions),
    technologies: toCommaList(log.technologies),
    skills: toCommaList(log.skills),
  };
}

export function structuredPayload(fields: StructuredFields) {
  return {
    summary: fields.summary.trim(),
    structuredContent: fields.summary.trim(),
    missions: parseLines(fields.missions),
    technologies: parseList(fields.technologies),
    skills: parseList(fields.skills),
  };
}

export const inputClass =
  "w-full rounded-xl border border-stone-200 bg-transparent p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-stone-700 dark:text-white";
