import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScheduleStatus } from "./schedule-status";
import type { IssueRecord } from "@/lib/content/issue-store";

const lastRun: IssueRecord = {
  id: "issue-1",
  html: "<html></html>",
  triggerType: "scheduled",
  marketSummary: "steady",
  listings: [{ address: "", neighborhood: "", price: 0, beds: 0, baths: 0, sqft: 0, blurb: "", photoUrls: [] }],
  createdAt: "2026-10-06T16:00:00Z",
  sentAt: null,
};

describe("ScheduleStatus", () => {
  it("shows the last run's date and listing count when a scheduled issue exists", () => {
    render(<ScheduleStatus scheduledIssues={[lastRun]} nextRun={new Date("2026-10-13T16:00:00Z")} />);
    expect(screen.getByText(/1 listing/i)).toBeInTheDocument();
  });

  it("shows a 'no runs yet' state when no scheduled issue exists", () => {
    render(<ScheduleStatus scheduledIssues={[]} nextRun={new Date("2026-10-13T16:00:00Z")} />);
    expect(screen.getByText(/no scheduled runs yet/i)).toBeInTheDocument();
  });

  it("always shows the next run time, with or without history", () => {
    render(<ScheduleStatus scheduledIssues={[]} nextRun={new Date("2026-10-13T16:00:00Z")} />);
    expect(screen.getByText(/next scheduled run/i)).toBeInTheDocument();
  });
});
