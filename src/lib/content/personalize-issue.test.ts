import { describe, it, expect } from "vitest";
import { personalizeIssueHtml } from "./personalize-issue";

describe("personalizeIssueHtml", () => {
  it("replaces the SUBSCRIBER_EMAIL placeholder with the URL-encoded recipient email", () => {
    const html = `<a href="https://example.com/unsubscribe?email={{SUBSCRIBER_EMAIL}}">Unsubscribe</a>`;
    const result = personalizeIssueHtml(html, "a+test@example.com");
    expect(result).toBe(`<a href="https://example.com/unsubscribe?email=a%2Btest%40example.com">Unsubscribe</a>`);
  });

  it("replaces every occurrence of the placeholder, not just the first", () => {
    const html = "{{SUBSCRIBER_EMAIL}} ... {{SUBSCRIBER_EMAIL}}";
    expect(personalizeIssueHtml(html, "x@y.com")).toBe("x%40y.com ... x%40y.com");
  });
});
