import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IssueList } from "./issue-list";
import type { IssueRecord } from "@/lib/content/issue-store";

const issue: IssueRecord = {
  id: "issue-1",
  html: "<html></html>",
  triggerType: "scheduled",
  marketSummary: "Seattle's market is holding steady this week.",
  listings: [],
  createdAt: "2026-10-06T16:00:00Z",
  sentAt: null,
};

describe("IssueList", () => {
  it("renders one row per issue with its trigger type and a view link", () => {
    render(<IssueList issues={[issue]} />);
    expect(screen.getByText(/holding steady/i)).toBeInTheDocument();
    expect(screen.getByText(/scheduled/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view/i })).toHaveAttribute("href", "/dashboard/archive/issue-1");
  });

  it("renders an empty state with no issues", () => {
    render(<IssueList issues={[]} />);
    expect(screen.getByText(/no issues yet/i)).toBeInTheDocument();
  });
});
