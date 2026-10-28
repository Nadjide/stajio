import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatLocalDate,
  getInternshipProgress,
  getInternshipWeek,
  getInternshipWeekStart,
  isCalendarDate,
} from "../../src/utils/internship";

afterEach(() => vi.unstubAllEnvs());

describe("Calendar dates", () => {
  it.each(["0001-01-01", "0099-12-31", "2000-02-29", "2024-02-29", "9999-12-31"])(
    "accepts the real calendar date %s",
    (value) => expect(isCalendarDate(value)).toBe(true),
  );

  it.each([
    "0000-01-01",
    "10000-01-01",
    "1900-02-29",
    "2026-02-29",
    "2026-04-31",
    "2026-99-99",
    "2026-00-01",
    "2026-01-00",
    "2026-1-01",
    "27/10/2026",
    "2026-10-27T00:00:00Z",
    "",
    null,
    undefined,
    20261027,
  ])("rejects the invalid calendar date %s", (value) => {
    expect(isCalendarDate(value)).toBe(false);
  });

  it("formats the user's local calendar day rather than a UTC timestamp", () => {
    expect(formatLocalDate(new Date(2026, 9, 27, 0, 1))).toBe("2026-10-27");
    expect(formatLocalDate(new Date(2026, 9, 27, 23, 59))).toBe("2026-10-27");
    const earlyYear = new Date(0);
    earlyYear.setFullYear(1, 0, 2);
    earlyYear.setHours(12, 0, 0, 0);
    expect(formatLocalDate(earlyYear)).toBe("0001-01-02");
  });
});

describe("Internship weeks", () => {
  it("counts seven-day periods starting on the internship's first day", () => {
    const start = "2026-10-21";
    expect(getInternshipWeek("2026-10-20", start)).toBe(0);
    expect(getInternshipWeek(start, start)).toBe(1);
    expect(getInternshipWeek("2026-10-27", start)).toBe(1);
    expect(getInternshipWeek("2026-10-28", start)).toBe(2);
    expect(getInternshipWeek("2026-11-04", start)).toBe(3);
  });

  it("never returns a negative week for notes before the internship", () => {
    expect(getInternshipWeek("2025-01-01", "2026-10-21")).toBe(0);
  });

  it("keeps counting dates after the internship instead of discarding them", () => {
    expect(getInternshipWeek("2026-12-02", "2026-10-21")).toBe(7);
  });

  it("handles leap days, year boundaries and years below 100", () => {
    expect(getInternshipWeek("2024-03-01", "2024-02-23")).toBe(2);
    expect(getInternshipWeek("2027-01-02", "2026-12-26")).toBe(2);
    expect(getInternshipWeek("0001-01-08", "0001-01-01")).toBe(2);
    expect(getInternshipWeek("0100-01-01", "0099-12-25")).toBe(2);
  });

  it.each(["Europe/Paris", "UTC"])("keeps seven calendar days across DST changes in %s", (timezone) => {
    vi.stubEnv("TZ", timezone);
    for (const [start, lastDay, nextWeek] of [
      ["2026-03-25", "2026-03-31", "2026-04-01"],
      ["2026-10-21", "2026-10-27", "2026-10-28"],
    ]) {
      expect(getInternshipWeek(lastDay, start)).toBe(1);
      expect(getInternshipWeek(nextWeek, start)).toBe(2);
      expect(getInternshipWeekStart(start, 2)).toBe(nextWeek);
    }
  });

  it("returns zero rather than propagating NaN for invalid legacy dates", () => {
    expect(getInternshipWeek("2026-02-30", "2026-01-01")).toBe(0);
    expect(getInternshipWeek("2026-01-01", "invalid")).toBe(0);
  });

  it("finds the same period starts across leap days and year boundaries", () => {
    expect(getInternshipWeekStart("2024-02-23", 1)).toBe("2024-02-23");
    expect(getInternshipWeekStart("2024-02-23", 2)).toBe("2024-03-01");
    expect(getInternshipWeekStart("2026-12-26", 2)).toBe("2027-01-02");
    expect(getInternshipWeekStart("0001-01-01", 2)).toBe("0001-01-08");
  });
});

describe("Internship progression", () => {
  it("starts at zero before the internship and reaches 100 on the last day", () => {
    const before = getInternshipProgress("2026-10-21", "2026-11-03", "2026-10-20");
    expect(before.totalWeeks).toBe(2);
    expect(before.currentWeek).toBe(0);
    expect(before.progress).toBe(0);

    const end = getInternshipProgress("2026-10-21", "2026-11-03", "2026-11-03");
    expect(end.currentWeek).toBe(2);
    expect(end.progress).toBe(100);
    expect(getInternshipProgress("2026-10-21", "2026-11-03", "2027-01-01").progress).toBe(100);
  });

  it("uses the same seven-day boundary as the journal and timeline", () => {
    const start = "2026-10-21";
    const end = "2026-11-04";
    expect(getInternshipProgress(start, end, "2026-10-27").currentWeek).toBe(1);
    expect(getInternshipProgress(start, end, "2026-10-28").currentWeek).toBe(2);
    expect(getInternshipProgress(start, end, "2026-11-04").totalWeeks).toBe(3);
  });

  it("handles an internship lasting one calendar day", () => {
    expect(getInternshipProgress("2026-10-27", "2026-10-27", "2026-10-26")).toEqual({
      totalWeeks: 1,
      currentWeek: 0,
      progress: 0,
    });
    expect(getInternshipProgress("2026-10-27", "2026-10-27", "2026-10-27")).toEqual({
      totalWeeks: 1,
      currentWeek: 1,
      progress: 100,
    });
  });
});
