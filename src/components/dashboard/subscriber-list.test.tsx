import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubscriberList } from "./subscriber-list";
import type { SubscriberRecord } from "@/lib/mcp/subscriber-store";

const subscribers: SubscriberRecord[] = [
  { email: "a@example.com", source: "Referral", subscribedAt: "2026-10-01T00:00:00Z" },
  { email: "b@example.com", source: null, subscribedAt: "2026-10-02T00:00:00Z" },
];

describe("SubscriberList", () => {
  it("renders an empty state with no subscribers", () => {
    render(<SubscriberList subscribers={[]} onRemove={async () => {}} />);
    expect(screen.getByText(/no subscribers yet/i)).toBeInTheDocument();
  });

  it("renders one row per subscriber and no bulk bar when nothing is selected", () => {
    render(<SubscriberList subscribers={subscribers} onRemove={async () => {}} />);
    expect(screen.getByText("a@example.com")).toBeInTheDocument();
    expect(screen.getByText("b@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove selected/i })).not.toBeInTheDocument();
  });

  it("shows the bulk action bar after selecting a row, and calls onRemove with the selected emails", async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined);
    render(<SubscriberList subscribers={subscribers} onRemove={onRemove} />);
    await userEvent.click(screen.getByRole("checkbox", { name: /select a@example.com/i }));
    expect(screen.getByRole("button", { name: /remove selected/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /remove selected/i }));
    expect(onRemove).toHaveBeenCalledWith(["a@example.com"]);
  });
});
