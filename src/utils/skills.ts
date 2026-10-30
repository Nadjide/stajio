import type { LogEntry, Skill, SkillLevel } from "../types/models";

export const SKILL_LEVELS: Array<{ value: SkillLevel; label: string; description: string }> = [
  { value: "to_work", label: "À travailler", description: "Je l'ai peu pratiquée ou j'ai encore besoin d'aide." },
  {
    value: "practicing",
    label: "En pratique",
    description: "Je la mobilise régulièrement avec un peu d'accompagnement.",
  },
  { value: "autonomous", label: "Autonome", description: "Je la mobilise sans aide et je peux l'expliquer." },
];

export const SKILL_LEVEL_LABELS = Object.fromEntries(SKILL_LEVELS.map((level) => [level.value, level.label])) as Record<
  SkillLevel,
  string
>;

export const SKILL_LEVEL_STYLES: Record<SkillLevel, string> = {
  to_work: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  practicing: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  autonomous: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

const key = (label: string) => label.trim().toLocaleLowerCase("fr");

export type SkillSuggestion = { label: string; logIds: string[] };

/** Labels extracted by the AI that the student has not turned into a skill yet. */
export function skillSuggestions(logs: LogEntry[], skills: Skill[]): SkillSuggestion[] {
  const known = new Set(skills.map((skill) => key(skill.label)));
  const suggestions = new Map<string, SkillSuggestion>();
  for (const log of logs) {
    for (const label of log.skills ?? []) {
      const normalized = key(label);
      if (!normalized || known.has(normalized)) continue;
      const suggestion = suggestions.get(normalized) ?? { label: label.trim(), logIds: [] };
      if (!suggestion.logIds.includes(log.id)) suggestion.logIds.push(log.id);
      suggestions.set(normalized, suggestion);
    }
  }
  return [...suggestions.values()].sort((a, b) => b.logIds.length - a.logIds.length || a.label.localeCompare(b.label));
}
