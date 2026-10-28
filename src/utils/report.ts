import type { Report, ReportBrief, ReportSection } from "../types/models";
import { countToComplete } from "./ai-budget";

/** Starting plan when the student does not ask the model for one. */
export const DEFAULT_REPORT_PLAN: Array<Pick<ReportSection, "title" | "intent">> = [
  { title: "Introduction", intent: "Présenter le contexte du stage, la problématique et l'annonce du plan." },
  { title: "Présentation de l'entreprise", intent: "Décrire l'entreprise, son activité et le service d'accueil." },
  { title: "Missions réalisées", intent: "Détailler les missions confiées, la démarche suivie et les résultats." },
  { title: "Compétences développées", intent: "Relier les missions aux compétences mobilisées et acquises." },
  { title: "Bilan et difficultés", intent: "Analyser les difficultés rencontrées, les solutions et le recul pris." },
  { title: "Conclusion", intent: "Répondre à la problématique et ouvrir sur le projet professionnel." },
];

export function emptyBrief(periodStart: string, periodEnd: string, sourceLogIds: string[]): ReportBrief {
  return { guidelines: "", problem: "", targetLength: "", periodStart, periodEnd, sourceLogIds };
}

/** Information the student should provide before asking for a generation. */
export function missingBriefInformation(brief: ReportBrief): string[] {
  const missing: string[] = [];
  if (!brief.guidelines.trim()) missing.push("Les consignes de l'école ne sont pas renseignées.");
  if (!brief.problem.trim()) missing.push("La problématique n'est pas définie.");
  if (!brief.targetLength.trim()) missing.push("La longueur attendue n'est pas précisée.");
  if (!brief.sourceLogIds.length) missing.push("Aucune note du journal n'est sélectionnée.");
  if (brief.periodStart && brief.periodEnd && brief.periodEnd < brief.periodStart) {
    missing.push("La fin de la période précède son début.");
  }
  return missing;
}

export function assembleReportMarkdown(report: Pick<Report, "title" | "sections">): string {
  const body = report.sections
    .map((section) => `# ${section.title.trim() || "Section sans titre"}\n\n${section.content.trim()}`)
    .join("\n\n");
  return `${body}\n`;
}

export function reportToComplete(report: Pick<Report, "sections">): number {
  return report.sections.reduce((total, section) => total + countToComplete(section.content), 0);
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}
