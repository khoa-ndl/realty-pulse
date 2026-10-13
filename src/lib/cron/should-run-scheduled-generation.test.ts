import { describe, it, expect } from "vitest";
import { shouldRunScheduledGeneration } from "./should-run-scheduled-generation";

describe("shouldRunScheduledGeneration", () => {
  it("returns true when no scheduled issue has ever been generated", () => {
    expect(shouldRunScheduledGeneration(new Date("2026-10-12T22:00:00Z"), null)).toBe(true);
  });

  it("returns false when the last scheduled issue was generated this week, at or after the boundary", () => {
    const now = new Date("2026-10-12T22:00:00Z"); // Monday afternoon
    const lastRun = new Date("2026-10-12T17:00:00Z"); // Monday 10am PT, this week's boundary
    expect(shouldRunScheduledGeneration(now, lastRun)).toBe(false);
  });

  it("returns true when the last scheduled issue predates this week's boundary", () => {
    const now = new Date("2026-10-12T22:00:00Z"); // Monday afternoon, this week
    const lastRun = new Date("2026-10-05T17:00:00Z"); // last week's run
    expect(shouldRunScheduledGeneration(now, lastRun)).toBe(true);
  });

  it("returns false on a later day in the week once this week's run has already happened", () => {
    const tuesday = new Date("2026-10-13T12:00:00Z");
    const lastRun = new Date("2026-10-12T17:00:00Z"); // generated yesterday, this week's run
    expect(shouldRunScheduledGeneration(tuesday, lastRun)).toBe(false);
  });

  it("returns false on Monday before 9am PT when last week's run already happened (not due again yet)", () => {
    const mondayMorning = new Date("2026-10-12T14:00:00Z"); // 7am PT Monday, today's boundary hasn't passed
    const lastWeeksRun = new Date("2026-10-05T17:00:00Z");
    expect(shouldRunScheduledGeneration(mondayMorning, lastWeeksRun)).toBe(false);
  });

  it("is still due across the PST/PDT transition (DST change doesn't shift the boundary unexpectedly)", () => {
    // 2026-11-01 is the Sunday before the US fall-back; by 2026-11-02 (Monday)
    // Los Angeles has moved from PDT (UTC-7) to PST (UTC-8).
    const mondayAfterFallBack = new Date("2026-11-02T20:00:00Z"); // Monday afternoon, now in PST
    const lastRunBeforeFallBack = new Date("2026-10-26T16:00:00Z"); // prior Monday, still in PDT
    expect(shouldRunScheduledGeneration(mondayAfterFallBack, lastRunBeforeFallBack)).toBe(true);
  });
});
