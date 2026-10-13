// Can't mix dateStyle/timeStyle with timeZoneName (or any other component
// option) per the Intl.DateTimeFormat spec — spelled out as explicit fields
// instead.
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "short",
  day: "numeric",
});

/**
 * Renders a date/time explicitly in America/Los_Angeles, with a zone label,
 * regardless of the runtime's own local timezone. Used anywhere a
 * server-rendered timestamp would otherwise silently use the server's local
 * zone (UTC on most hosts) with no indication of which zone it is, and to
 * keep server and client renders identical (avoiding a hydration mismatch)
 * when the same value is formatted on both sides.
 */
export function formatPacificDateTime(date: Date | string): string {
  return DATE_TIME_FORMATTER.format(new Date(date));
}

export function formatPacificDate(date: Date | string): string {
  return DATE_FORMATTER.format(new Date(date));
}
