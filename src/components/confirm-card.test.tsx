import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmCard } from "./confirm-card";

describe("ConfirmCard", () => {
  it("shows an error state and no confirm button when the token is missing", () => {
    render(<ConfirmCard token={null} onConfirm={vi.fn()} />);
    expect(screen.getByText(/invalid/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /confirm/i })).not.toBeInTheDocument();
  });

  it("shows a confirm prompt and does not call onConfirm until the button is clicked", () => {
    const onConfirm = vi.fn();
    render(<ConfirmCard token="tok-1" onConfirm={onConfirm} />);
    expect(screen.getByRole("button", { name: /confirm/i })).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onConfirm with the token and shows a success state with the confirmed email", async () => {
    const onConfirm = vi.fn().mockResolvedValue({ email: "a@example.com" });
    render(<ConfirmCard token="tok-1" onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledWith("tok-1");
    expect(await screen.findByText(/you're confirmed/i)).toBeInTheDocument();
    expect(screen.getByText("a@example.com")).toBeInTheDocument();
  });

  it("shows an error and stays on the confirm screen if onConfirm fails", async () => {
    const onConfirm = vi.fn().mockResolvedValue({ error: "This confirmation link is invalid or has already been used." });
    render(<ConfirmCard token="tok-1" onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(await screen.findByText(/already been used/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm/i })).toBeInTheDocument();
  });
});
