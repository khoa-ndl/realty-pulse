import { describe, it, expect } from "vitest";
import { parseUnsubscribeEmail } from "./unsubscribe-email";

describe("parseUnsubscribeEmail", () => {
  it("returns the email when it's a valid address", () => {
    expect(parseUnsubscribeEmail("a@example.com")).toEqual({ email: "a@example.com" });
  });

  it("returns an error when the email param is missing", () => {
    expect(parseUnsubscribeEmail(undefined)).toEqual({ error: "This unsubscribe link is missing an email address." });
  });

  it("returns an error when the email param isn't a valid email", () => {
    expect(parseUnsubscribeEmail("not-an-email")).toEqual({ error: "This unsubscribe link is missing an email address." });
  });
});
