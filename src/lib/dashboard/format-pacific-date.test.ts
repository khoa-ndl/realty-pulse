import { describe, it, expect } from "vitest";
import { formatPacificDateTime, formatPacificDate } from "./format-pacific-date";

describe("formatPacificDateTime", () => {
  it("formats a date in America/Los_Angeles with a zone label, not the runtime's local zone", () => {
    const result = formatPacificDateTime("2026-10-06T16:00:00Z");
    // 16:00 UTC on Oct 6 2026 is 9:00 AM PDT — if this ran in the server's
    // (often UTC) local zone instead, it would show 4:00 PM with no zone
    // name at all.
    expect(result).toContain("9:00");
    expect(result).toMatch(/PDT|PST|GMT-\d/);
  });
});

describe("formatPacificDate", () => {
  it("renders the Pacific calendar date even when the UTC date differs", () => {
    // Midnight UTC on Oct 1 is still Sep 30 in Pacific time — a naive
    // runtime-local render (UTC on most servers) would show Oct 1, while a
    // browser in Pacific time would show Sep 30: a hydration mismatch this
    // function must not reproduce regardless of where it runs.
    const result = formatPacificDate("2026-10-01T00:00:00Z");
    expect(result).toContain("Sep 30");
  });
});
