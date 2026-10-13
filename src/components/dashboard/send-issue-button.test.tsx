import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SendIssueButton } from "./send-issue-button";

describe("SendIssueButton", () => {
  it("calls onSend with the issue id and shows the sent count on success", async () => {
    const onSend = vi.fn().mockResolvedValue({ sent: 42 });
    render(<SendIssueButton issueId="issue-1" subscriberCount={42} onSend={onSend} />);
    await userEvent.click(screen.getByRole("button", { name: /send to 42 subscribers/i }));
    expect(onSend).toHaveBeenCalledWith("issue-1");
    expect(await screen.findByText(/sent to 42 subscribers/i)).toBeInTheDocument();
  });

  it("shows an error and leaves the button clickable again if sending fails", async () => {
    const onSend = vi.fn().mockResolvedValue({ error: "This issue has already been sent." });
    render(<SendIssueButton issueId="issue-1" subscriberCount={42} onSend={onSend} />);
    await userEvent.click(screen.getByRole("button", { name: /send to 42 subscribers/i }));
    expect(await screen.findByText(/already been sent/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send to 42 subscribers/i })).toBeEnabled();
  });
});
