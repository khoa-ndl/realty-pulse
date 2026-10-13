import { describe, it, expect, vi } from "vitest";
import { sendIssue, type SendIssueDeps } from "./send-issue";
import type { IssueRecord } from "./issue-store";

const baseIssue: IssueRecord = {
  id: "issue-1",
  html: "Hello {{SUBSCRIBER_EMAIL}}",
  triggerType: "manual",
  marketSummary: "steady",
  listings: [],
  createdAt: "2026-10-12T00:00:00Z",
  sentAt: null,
};

function makeDeps(overrides: Partial<SendIssueDeps> = {}): SendIssueDeps {
  return {
    store: {
      getIssue: vi.fn().mockResolvedValue(baseIssue),
      markSent: vi.fn().mockResolvedValue(undefined),
    },
    client: {
      listSubscribers: vi.fn().mockResolvedValue([
        { email: "a@example.com", source: null, subscribedAt: "2026-10-01T00:00:00Z" },
        { email: "b@example.com", source: null, subscribedAt: "2026-10-01T00:00:00Z" },
      ]),
      sendEmail: vi.fn().mockResolvedValue(undefined),
    },
    subject: "Test Subject",
    ...overrides,
  };
}

describe("sendIssue", () => {
  it("returns an error when the issue doesn't exist", async () => {
    const deps = makeDeps({ store: { getIssue: vi.fn().mockResolvedValue(null), markSent: vi.fn() } });
    await expect(sendIssue(deps, "missing")).resolves.toEqual({ error: "Issue not found." });
  });

  it("returns an error and does not resend when the issue was already sent", async () => {
    const deps = makeDeps({
      store: { getIssue: vi.fn().mockResolvedValue({ ...baseIssue, sentAt: "2026-10-12T01:00:00Z" }), markSent: vi.fn() },
    });
    const result = await sendIssue(deps, "issue-1");
    expect(result).toEqual({ error: "This issue has already been sent." });
    expect(deps.client.sendEmail).not.toHaveBeenCalled();
  });

  it("sends each subscriber their own personalized HTML, then marks the issue sent", async () => {
    const deps = makeDeps();
    const result = await sendIssue(deps, "issue-1");
    expect(result).toEqual({ sent: 2 });
    expect(deps.client.sendEmail).toHaveBeenCalledWith("a@example.com", "Test Subject", "Hello a%40example.com");
    expect(deps.client.sendEmail).toHaveBeenCalledWith("b@example.com", "Test Subject", "Hello b%40example.com");
    expect(deps.store.markSent).toHaveBeenCalledWith("issue-1");
  });

  it("completes and marks the issue sent when there are zero active subscribers", async () => {
    const deps = makeDeps({ client: { listSubscribers: vi.fn().mockResolvedValue([]), sendEmail: vi.fn() } });
    const result = await sendIssue(deps, "issue-1");
    expect(result).toEqual({ sent: 0 });
    expect(deps.store.markSent).toHaveBeenCalledWith("issue-1");
  });

  it("stops on the first send failure, reports how many succeeded, and does not mark the issue sent", async () => {
    const sendEmail = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Gmail rate limited"));
    const deps = makeDeps({ client: { listSubscribers: vi.fn().mockResolvedValue([
      { email: "a@example.com", source: null, subscribedAt: "2026-10-01T00:00:00Z" },
      { email: "b@example.com", source: null, subscribedAt: "2026-10-01T00:00:00Z" },
    ]), sendEmail } });
    const result = await sendIssue(deps, "issue-1");
    expect(result).toEqual({
      error: "Sent to 1 of 2 subscribers before a failure (Gmail rate limited). The issue was not marked sent — check logs before retrying to avoid duplicate sends.",
    });
    expect(deps.store.markSent).not.toHaveBeenCalled();
  });
});
