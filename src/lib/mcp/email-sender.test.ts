import { describe, it, expect, vi } from "vitest";
import { buildRawMimeMessage, GmailEmailSender, type GmailClient } from "./email-sender";

function decode(raw: string): string {
  return Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

describe("buildRawMimeMessage", () => {
  it("base64url-encodes a message with To, Subject, and html body", () => {
    const raw = buildRawMimeMessage({ to: "a@example.com", subject: "Hi there", html: "<p>hello</p>" });
    expect(raw).not.toMatch(/[+/=]/);
    const decoded = decode(raw);
    expect(decoded).toContain("To: a@example.com");
    expect(decoded).toContain("Subject: Hi there");
    expect(decoded).toContain("<p>hello</p>");
  });
});

describe("GmailEmailSender", () => {
  it("sends the built raw message through the client", async () => {
    const client: GmailClient = { sendRawMessage: vi.fn().mockResolvedValue(undefined) };
    const sender = new GmailEmailSender(client);
    await sender.sendEmail("a@example.com", "Hi there", "<p>hello</p>");
    expect(client.sendRawMessage).toHaveBeenCalledTimes(1);
    const raw = vi.mocked(client.sendRawMessage).mock.calls[0][0];
    expect(decode(raw)).toContain("To: a@example.com");
  });
});
