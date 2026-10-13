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

  it("uses the PDT offset (UTC-7) for a 9am run deep in daylight time", () => {
    // Mid-July: safely interior to DST, so the following Monday is also in
    // DST regardless of what weekday mid-July falls on this particular year.
    const midJuly = new Date(Date.UTC(2026, 6, 15, 12, 0, 0));
    const next = nextScheduledRun(midJuly);
    expect(next.getUTCDay()).toBe(1);
    expect(next.getUTCHours()).toBe(16); // 9:00 AM PDT = 16:00 UTC
  });

  it("uses the PST offset (UTC-8) for a 9am run deep in standard time", () => {
    // Mid-December: safely interior to standard time for the same reason.
    const midDecember = new Date(Date.UTC(2026, 11, 15, 12, 0, 0));
    const next = nextScheduledRun(midDecember);
    expect(next.getUTCDay()).toBe(1);
    expect(next.getUTCHours()).toBe(17); // 9:00 AM PST = 17:00 UTC
  });
});
