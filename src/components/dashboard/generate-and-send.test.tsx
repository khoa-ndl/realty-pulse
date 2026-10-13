import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GenerateAndSend } from "./generate-and-send";

describe("GenerateAndSend", () => {
  it("starts idle and generates a preview on click", async () => {
    const onGenerate = vi.fn().mockResolvedValue({ issueId: "issue-1", html: "<html>preview</html>" });
    render(<GenerateAndSend subscriberCount={214} onGenerate={onGenerate} onSend={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /generate preview/i }));
    expect(onGenerate).toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: /send to 214 subscribers/i })).toBeInTheDocument();
  });

  it("shows a retryable error on the idle screen when generation fails, without advancing", async () => {
    const onGenerate = vi.fn().mockResolvedValue({ error: "Perplexity API error" });
    render(<GenerateAndSend subscriberCount={214} onGenerate={onGenerate} onSend={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /generate preview/i }));
    expect(await screen.findByText(/perplexity api error/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate preview/i })).toBeInTheDocument();
  });

  it("moves to the sent state after confirming send, and reports the real count", async () => {
    const onGenerate = vi.fn().mockResolvedValue({ issueId: "issue-1", html: "<html>preview</html>" });
    const onSend = vi.fn().mockResolvedValue({ sent: 214 });
    render(<GenerateAndSend subscriberCount={214} onGenerate={onGenerate} onSend={onSend} />);
    await userEvent.click(screen.getByRole("button", { name: /generate preview/i }));
    await userEvent.click(await screen.findByRole("button", { name: /send to 214 subscribers/i }));
    expect(onSend).toHaveBeenCalledWith("issue-1");
    expect(await screen.findByText(/sent to 214 subscribers/i)).toBeInTheDocument();
  });

  it("re-enables the Generate button if onGenerate itself rejects (not just returns an error)", async () => {
    const onGenerate = vi.fn().mockRejectedValue(new Error("network error"));
    render(<GenerateAndSend subscriberCount={214} onGenerate={onGenerate} onSend={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /generate preview/i }));
    await expect(onGenerate).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /generate preview/i })).toBeEnabled();
  });

  it('returns to idle on "Generate another" from the sent state', async () => {
    const onGenerate = vi.fn().mockResolvedValue({ issueId: "issue-1", html: "<html>preview</html>" });
    const onSend = vi.fn().mockResolvedValue({ sent: 214 });
    render(<GenerateAndSend subscriberCount={214} onGenerate={onGenerate} onSend={onSend} />);
    await userEvent.click(screen.getByRole("button", { name: /generate preview/i }));
    await userEvent.click(await screen.findByRole("button", { name: /send to 214 subscribers/i }));
    await userEvent.click(await screen.findByRole("button", { name: /generate another/i }));
    expect(screen.getByRole("button", { name: /generate preview/i })).toBeInTheDocument();
  });
});
