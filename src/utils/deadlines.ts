import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Deadline } from "../types/models";

export type Urgency = {
  label: string;
  tone: "overdue" | "today" | "soon" | "later" | "done";
};

export function getUrgency(deadline: Deadline, now: Date = new Date()): Urgency {
  if (deadline.completed) return { label: "Terminé", tone: "done" };

  const days = differenceInCalendarDays(parseISO(deadline.date), now);
  if (days < 0) return { label: days === -1 ? "Hier" : `En retard de ${-days} j`, tone: "overdue" };
  if (days === 0) return { label: "Aujourd'hui", tone: "today" };
  if (days === 1) return { label: "Demain", tone: "soon" };
  if (days <= 7) return { label: `Dans ${days} j`, tone: "soon" };
  return { label: `Dans ${days} j`, tone: "later" };
}

export const URGENCY_STYLES: Record<Urgency["tone"], string> = {
  overdue: "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400",
  today: "bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
  soon: "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
  later: "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400",
  done: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
};

export const TYPE_LABELS: Record<Deadline["type"], string> = {
  school: "École",
  company: "Entreprise",
};

/** Tri: non terminées d'abord (par date croissante), puis terminées. */
export function sortDeadlines(deadlines: Deadline[]): Deadline[] {
  return [...deadlines].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return a.date.localeCompare(b.date);
  });
}
