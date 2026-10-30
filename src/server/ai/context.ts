import { db } from "../db";
import { parseJsonArray } from "../utils";
import { estimateTokens } from "../../utils/ai-budget";
import { getInternshipWeek, getInternshipWeekLabel } from "../../utils/internship";
import type { SourceSnapshot } from "../../types/models";
import { AiError, INPUT_BUDGET_TOKENS } from "./ollama";

export type ProfileContext = {
  displayName: string;
  school: string;
  degree: string;
  company: string;
  tutorName: string;
  internshipStart: string;
  internshipEnd: string;
};

type LogRow = {
  id: string;
  date: string;
  rawContent: string;
  summary: string | null;
  missions: string | null;
  technologies: string | null;
};

export function loadProfile(uid: string): ProfileContext {
  const row = db
    .prepare(
      "SELECT displayName, school, degree, company, tutorName, internshipStart, internshipEnd FROM users WHERE uid = ?",
    )
    .get(uid) as Partial<Record<keyof ProfileContext, string | null>> | undefined;
  if (!row) throw new AiError("invalid_input", "Ce compte n'existe plus. Reconnecte-toi.");
  return {
    displayName: row.displayName || "",
    school: row.school || "",
    degree: row.degree || "",
    company: row.company || "",
    tutorName: row.tutorName || "",
    internshipStart: row.internshipStart || "",
    internshipEnd: row.internshipEnd || "",
  };
}

/** The text sent to the model for one note. The raw note stays the reference. */
function noteText(row: LogRow, internshipStart: string) {
  const week = getInternshipWeekLabel(getInternshipWeek(row.date, internshipStart));
  const lines = [`Note du ${row.date} (${week}) : ${row.rawContent.trim()}`];
  const missions = parseJsonArray<string>(row.missions);
  const technologies = parseJsonArray<string>(row.technologies);
  if (row.summary?.trim() && row.summary.trim() !== row.rawContent.trim()) lines.push(`Résumé : ${row.summary.trim()}`);
  if (missions.length) lines.push(`Missions : ${missions.join(" ; ")}`);
  if (technologies.length) lines.push(`Technologies : ${technologies.join(", ")}`);
  return lines.join("\n");
}

/**
 * Loads the account's notes, oldest first. When ids are given, every one must
 * belong to the account so a stale selection never silently drops sources.
 */
export function loadSources(uid: string, logIds?: string[]): SourceSnapshot[] {
  const profile = loadProfile(uid);
  const rows = db
    .prepare("SELECT id, date, rawContent, summary, missions, technologies FROM logs WHERE uid = ? ORDER BY date, id")
    .all(uid) as LogRow[];
  let selected = rows;
  if (logIds) {
    const wanted = new Set(logIds);
    selected = rows.filter((row) => wanted.has(row.id));
    if (selected.length !== wanted.size) {
      throw new AiError(
        "invalid_input",
        "Certaines notes sélectionnées n'existent plus. Actualise la sélection avant de relancer.",
      );
    }
  }
  return selected.map((row) => ({ id: row.id, date: row.date, text: noteText(row, profile.internshipStart) }));
}

export function formatProfile(profile: ProfileContext) {
  return [
    `Étudiant : ${profile.displayName || "[non renseigné]"}`,
    `Formation : ${profile.degree || "[non renseignée]"} — ${profile.school || "[école non renseignée]"}`,
    `Entreprise : ${profile.company || "[non renseignée]"}`,
    `Tuteur : ${profile.tutorName || "[non renseigné]"}`,
    `Période : du ${profile.internshipStart || "?"} au ${profile.internshipEnd || "?"}`,
  ].join("\n");
}

export function formatSources(sources: SourceSnapshot[]) {
  return sources.length ? sources.map((source) => source.text).join("\n\n") : "[Aucune note de journal fournie]";
}

export function measurePrompt(parts: string[]) {
  const estimatedTokens = estimateTokens(parts.join("\n"));
  return { estimatedTokens, budgetTokens: INPUT_BUDGET_TOKENS, fits: estimatedTokens <= INPUT_BUDGET_TOKENS };
}

/** Refuse instead of letting Ollama silently drop the beginning of the prompt. */
export function assertWithinBudget(parts: string[], noteCount: number) {
  const measure = measurePrompt(parts);
  if (!measure.fits) {
    throw new AiError(
      "context_too_large",
      `La sélection est trop longue pour le modèle (environ ${measure.estimatedTokens} jetons pour une limite de ${measure.budgetTokens}). Réduis la période ou le nombre de notes, ou génère le rapport section par section.`,
      { ...measure, noteCount },
    );
  }
  return measure;
}
