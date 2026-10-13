import { describe, it, expect } from "vitest";
import { shouldRedirectTo } from "./route-guard";

describe("shouldRedirectTo", () => {
  it("redirects an unauthenticated request to a dashboard route to /login", () => {
    expect(shouldRedirectTo("/dashboard/archive", false)).toBe("/login");
  });

  it("redirects an authenticated request to /login to /dashboard", () => {
    expect(shouldRedirectTo("/login", true)).toBe("/dashboard");
  });

  it("allows an authenticated request to a dashboard route through", () => {
    expect(shouldRedirectTo("/dashboard/archive", true)).toBeNull();
  });

  it("allows an unauthenticated request to /login through", () => {
    expect(shouldRedirectTo("/login", false)).toBeNull();
  });

  it("allows an unauthenticated request to a non-dashboard route through", () => {
    expect(shouldRedirectTo("/subscribe", false)).toBeNull();
  });
});
