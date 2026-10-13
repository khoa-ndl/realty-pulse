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

  it("returns false on a day that isn't yet at this week's boundary", () => {
    const tuesday = new Date("2026-10-13T12:00:00Z");
    const lastRun = new Date("2026-10-12T17:00:00Z"); // generated yesterday, this week's run
    expect(shouldRunScheduledGeneration(tuesday, lastRun)).toBe(false);
  });
});
