import { describe, it, expect } from "vitest";
import { parseAddSubscriberForm } from "./subscriber-form";

describe("parseAddSubscriberForm", () => {
  it("returns the email and source from valid form data", () => {
    const form = new FormData();
    form.set("email", "a@example.com");
    form.set("source", "Referral");
    expect(parseAddSubscriberForm(form)).toEqual({ email: "a@example.com", source: "Referral" });
  });

  it("omits source when blank", () => {
    const form = new FormData();
    form.set("email", "a@example.com");
    form.set("source", "");
    expect(parseAddSubscriberForm(form)).toEqual({ email: "a@example.com", source: undefined });
  });

  it("returns an error for a malformed email", () => {
    const form = new FormData();
    form.set("email", "not-an-email");
    expect(parseAddSubscriberForm(form)).toEqual({ error: "Enter a valid email address." });
  });

  it("returns an error for a missing email", () => {
    const form = new FormData();
    expect(parseAddSubscriberForm(form)).toEqual({ error: "Enter a valid email address." });
  });
});
