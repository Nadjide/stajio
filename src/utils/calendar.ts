import type { Deadline } from "../types/models";
import { TYPE_LABELS } from "./deadlines";

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 limits lines to 75 octets; continuation lines start with a space. */
function fold(line: string) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  for (const character of line) {
    const limit = parts.length ? 74 : 75;
    if (encoder.encode(current + character).length > limit) {
      parts.push(current);
      current = character;
    } else {
      current += character;
    }
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function compactDate(date: string) {
  return date.replace(/-/g, "");
}

function nextDay(date: string) {
  const day = new Date(`${date}T00:00:00.000Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

function stamp(now: Date) {
  return now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** All-day events, importable in common calendar applications. */
export function deadlinesToIcs(deadlines: Deadline[], now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Stajio//Echeances//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  lines.push("X-WR-CALNAME:Échéances Stajio");
  for (const deadline of deadlines) {
    const summary = `${deadline.title}${deadline.completed ? " (terminée)" : ""}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeText(deadline.id)}@stajio`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${compactDate(deadline.date)}`,
      `DTEND;VALUE=DATE:${compactDate(nextDay(deadline.date))}`,
      `SUMMARY:${escapeText(summary)}`,
      `CATEGORIES:${escapeText(TYPE_LABELS[deadline.type])}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
