import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getEnv, ENV_KEYS } from "./env";

const REQUIRED: Record<string, string> = {
  ANTHROPIC_API_KEY: "test",
  PERPLEXITY_API_KEY: "test",
  KIE_AI_API_KEY: "test",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test",
  GMAIL_CLIENT_ID: "test",
  GMAIL_CLIENT_SECRET: "test",
  GMAIL_REFRESH_TOKEN: "test",
  MCP_OUTBOUND_TOKEN: "test",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test",
  CRON_SECRET: "test",
};

describe("getEnv", () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    for (const k of Object.keys(REQUIRED)) delete process.env[k];
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns a typed object when every required key is present", () => {
    Object.assign(process.env, REQUIRED);
    const env = getEnv();
    expect(env.ANTHROPIC_API_KEY).toBe("test");
  });

  it("throws naming the missing key when one is absent", () => {
    Object.assign(process.env, REQUIRED);
    delete process.env.PERPLEXITY_API_KEY;
    expect(() => getEnv()).toThrowError(/PERPLEXITY_API_KEY/);
  });

  it("ENV_KEYS lists exactly the required keys", () => {
    expect(new Set(ENV_KEYS)).toEqual(new Set(Object.keys(REQUIRED)));
  });

  it("rejects a whitespace-only value for a required key", () => {
    Object.assign(process.env, REQUIRED);
    process.env.ANTHROPIC_API_KEY = "   ";
    expect(() => getEnv()).toThrowError(/ANTHROPIC_API_KEY/);
  });

  it("rejects a malformed Supabase URL", () => {
    Object.assign(process.env, REQUIRED);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "not-a-url";
    expect(() => getEnv()).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
