import { describe, it, expect } from "vitest";
import { renderConfirmationEmailHtml } from "./confirmation-email";

describe("renderConfirmationEmailHtml", () => {
  it("includes the confirm URL as a link", () => {
    const html = renderConfirmationEmailHtml("https://realtypulse.example.com/confirm?token=abc123");
    expect(html).toContain('href="https://realtypulse.example.com/confirm?token=abc123"');
  });

  it("escapes the URL for safe HTML attribute embedding", () => {
    const html = renderConfirmationEmailHtml('https://example.com/confirm?token=a"b');
    expect(html).not.toContain('token=a"b"');
    expect(html).toContain("a&quot;b");
  });
});
