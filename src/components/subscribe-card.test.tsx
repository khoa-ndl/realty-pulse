import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubscribeCard } from "./subscribe-card";

describe("SubscribeCard", () => {
  it("submits the entered email and shows the same success message on success", async () => {
    const onSubscribe = vi.fn().mockResolvedValue({ success: true });
    render(<SubscribeCard onSubscribe={onSubscribe} />);
    await userEvent.type(screen.getByLabelText(/email/i), "a@example.com");
    await userEvent.click(screen.getByRole("button", { name: /subscribe/i }));
    expect(onSubscribe).toHaveBeenCalledWith("a@example.com");
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });

  it("shows a validation error for an invalid email without calling onSubscribe", async () => {
    const onSubscribe = vi.fn();
    render(<SubscribeCard onSubscribe={onSubscribe} />);
    await userEvent.type(screen.getByLabelText(/email/i), "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: /subscribe/i }));
    expect(onSubscribe).not.toHaveBeenCalled();
  });

  it("shows the same success message even when onSubscribe reports the email was already active", async () => {
    const onSubscribe = vi.fn().mockResolvedValue({ success: true });
    render(<SubscribeCard onSubscribe={onSubscribe} />);
    await userEvent.type(screen.getByLabelText(/email/i), "already@example.com");
    await userEvent.click(screen.getByRole("button", { name: /subscribe/i }));
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });
});
