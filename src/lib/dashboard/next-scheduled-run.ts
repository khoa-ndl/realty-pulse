const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function part(parts: Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((p) => p.type === type)?.value ?? "";
}

function losAngelesOffsetMinutes(utcGuess: Date): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    timeZoneName: "shortOffset",
  }).formatToParts(utcGuess);
  const match = part(formatted, "timeZoneName").match(/GMT([+-]\d+)/);
  const hoursOffset = match ? Number(match[1]) : -8;
  return hoursOffset * 60;
}

function mondayNineAmPt(year: number, month: number, day: number, dayOffset: number): Date {
  // Treat the target Y/M/D 09:00 as if they were UTC fields — a convenient
  // container for the LA wall-clock numbers, not a real instant yet.
  const wallClockAsUtc = new Date(Date.UTC(year, month - 1, day + dayOffset, 9, 0, 0));
  const offsetMinutes = losAngelesOffsetMinutes(wallClockAsUtc);
  return new Date(wallClockAsUtc.getTime() - offsetMinutes * 60_000);
}

function currentLosAngelesParts(now: Date): { weekday: number; year: number; month: number; day: number; hour: number } {
  const nowParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);

  return {
    weekday: WEEKDAY_INDEX[part(nowParts, "weekday")],
    year: Number(part(nowParts, "year")),
    month: Number(part(nowParts, "month")),
    day: Number(part(nowParts, "day")),
    hour: Number(part(nowParts, "hour")),
  };
}

/**
 * The next Monday 9:00 AM America/Los_Angeles strictly after `now`, correct
 * across the PST/PDT transition (the offset is looked up for the target
 * date, not assumed from `now`'s own offset).
 */
export function nextScheduledRun(now: Date): Date {
  const { weekday, year, month, day, hour } = currentLosAngelesParts(now);

  let daysUntilMonday = (1 - weekday + 7) % 7;
  if (daysUntilMonday === 0 && hour >= 9) {
    daysUntilMonday = 7;
  }

  return mondayNineAmPt(year, month, day, daysUntilMonday);
}

/**
 * The most recent Monday 9:00 AM America/Los_Angeles at or before `now`,
 * using the same DST-safe technique as `nextScheduledRun`.
 */
export function mostRecentScheduledRun(now: Date): Date {
  const { weekday, year, month, day, hour } = currentLosAngelesParts(now);

  let daysSinceMonday = (weekday - 1 + 7) % 7;
  if (daysSinceMonday === 0 && hour < 9) {
    daysSinceMonday = 7;
  }

  return mondayNineAmPt(year, month, day, -daysSinceMonday);
}
