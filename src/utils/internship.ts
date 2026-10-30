const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** Parse calendar days in UTC so seven days stay seven days across DST changes. */
function calendarDay(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date.getTime() / DAY_IN_MS;
}

export function isCalendarDate(value: unknown): value is string {
  return calendarDay(value) !== null;
}

/** A date before the internship is week zero; week one starts on its first day. */
export function getInternshipWeek(date: string, start: string): number {
  const day = calendarDay(date);
  const firstDay = calendarDay(start);
  if (day === null || firstDay === null || day < firstDay) return 0;
  return Math.floor((day - firstDay) / 7) + 1;
}

export function getInternshipWeekStart(start: string, weekNumber: number): string {
  const firstDay = calendarDay(start);
  if (firstDay === null || !Number.isSafeInteger(weekNumber) || weekNumber < 1) return "";
  const date = new Date((firstDay + (weekNumber - 1) * 7) * DAY_IN_MS);
  if (!Number.isFinite(date.getTime())) return "";
  const value = date.toISOString().slice(0, 10);
  return isCalendarDate(value) ? value : "";
}

export function getInternshipWeekLabel(weekNumber: number, totalWeeks?: number): string {
  if (weekNumber === 0) return "Avant le stage";
  if (totalWeeks && weekNumber > totalWeeks) return `Après le stage (semaine ${weekNumber})`;
  return `Semaine ${weekNumber}`;
}

export function addCalendarDays(date: string, days: number): string {
  const day = calendarDay(date);
  if (day === null || !Number.isSafeInteger(days)) return "";
  const value = new Date((day + days) * DAY_IN_MS).toISOString().slice(0, 10);
  return isCalendarDate(value) ? value : "";
}

/** Middle calendar day of the period, rounded down. */
export function getInternshipMidpoint(start: string, end: string): string {
  const first = calendarDay(start);
  const last = calendarDay(end);
  if (first === null || last === null || last < first) return "";
  return addCalendarDays(start, Math.floor((last - first) / 2));
}

/** V1 rule: a note outside the internship is allowed but flagged before it is saved. */
export function getPeriodPosition(date: string, start: string, end: string): "before" | "during" | "after" | "unknown" {
  if (!isCalendarDate(date) || !isCalendarDate(start) || !isCalendarDate(end)) return "unknown";
  if (date < start) return "before";
  if (date > end) return "after";
  return "during";
}

/** Use the browser's local day at the boundary; all subsequent math is date-only. */
export function formatLocalDate(date = new Date()): string {
  return [
    date.getFullYear().toString().padStart(4, "0"),
    (date.getMonth() + 1).toString().padStart(2, "0"),
    date.getDate().toString().padStart(2, "0"),
  ].join("-");
}

export function getInternshipProgress(start: string, end: string, today = formatLocalDate()) {
  const firstDay = calendarDay(start);
  const lastDay = calendarDay(end);
  const currentDay = calendarDay(today);
  if (firstDay === null || lastDay === null || currentDay === null || lastDay < firstDay) {
    return { totalWeeks: 0, currentWeek: 0, progress: 0 };
  }
  const totalWeeks = getInternshipWeek(end, start);
  const currentWeek = Math.min(getInternshipWeek(today, start), totalWeeks);
  const duration = lastDay - firstDay;
  const progress =
    currentDay < firstDay ? 0 : duration === 0 ? 100 : Math.min(((currentDay - firstDay) / duration) * 100, 100);
  return { totalWeeks, currentWeek, progress };
}
