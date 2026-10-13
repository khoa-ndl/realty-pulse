import { describe, it, expect } from "vitest";
import { nextScheduledRun } from "./next-scheduled-run";

describe("nextScheduledRun", () => {
  it("returns the coming Monday 9am Los_Angeles time when now is a Wednesday", () => {
    const wednesday = new Date("2026-10-07T18:00:00Z"); // a Wednesday
    const next = nextScheduledRun(wednesday);
    expect(next.getUTCDay()).toBe(1); // next occurrence is a Monday
    expect(next.getTime()).toBeGreaterThan(wednesday.getTime());
  });

  it("returns next Monday, not today, when now is already Monday after 9am PT", () => {
    const mondayAfternoon = new Date("2026-10-12T22:00:00Z"); // Monday, past 9am PT
    const next = nextScheduledRun(mondayAfternoon);
    expect(next.getTime()).toBeGreaterThan(mondayAfternoon.getTime());
    const daysOut = (next.getTime() - mondayAfternoon.getTime()) / (24 * 60 * 60 * 1000);
    expect(daysOut).toBeGreaterThan(6);
  });
});
