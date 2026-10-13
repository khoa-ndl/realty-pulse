import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UnsubscribeCard } from "./unsubscribe-card";

describe("UnsubscribeCard", () => {
  it("shows an error state and no confirm button when the email is invalid", () => {
    render(<UnsubscribeCard email={null} onUnsubscribe={vi.fn()} />);
    expect(screen.getByText(/missing an email address/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /unsubscribe/i })).not.toBeInTheDocument();
  });

  it("shows a confirm screen with the email and asks for confirmation before unsubscribing", () => {
    render(<UnsubscribeCard email="a@example.com" onUnsubscribe={vi.fn()} />);
    expect(screen.getByText("a@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /unsubscribe/i })).toBeInTheDocument();
  });

  it("calls onUnsubscribe and shows a success state after confirming", async () => {
    const onUnsubscribe = vi.fn().mockResolvedValue({ success: true });
    render(<UnsubscribeCard email="a@example.com" onUnsubscribe={onUnsubscribe} />);
    await userEvent.click(screen.getByRole("button", { name: /unsubscribe/i }));
    expect(onUnsubscribe).toHaveBeenCalledWith("a@example.com");
    expect(await screen.findByText(/you've been unsubscribed/i)).toBeInTheDocument();
  });

  it("shows an error and stays on the confirm screen if onUnsubscribe fails", async () => {
    const onUnsubscribe = vi.fn().mockResolvedValue({ error: "Something went wrong." });
    render(<UnsubscribeCard email="a@example.com" onUnsubscribe={onUnsubscribe} />);
    await userEvent.click(screen.getByRole("button", { name: /unsubscribe/i }));
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /unsubscribe/i })).toBeInTheDocument();
  });
});
