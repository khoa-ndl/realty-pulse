import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET } from "./route";

const REQUIRED_ENV: Record<string, string> = {
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
  CRON_SECRET: "test-cron-secret",
};

describe("GET /api/cron/generate-issue", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, REQUIRED_ENV);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns 401 when the Authorization header is missing", async () => {
    const response = await GET(new Request("http://localhost/api/cron/generate-issue"));
    expect(response.status).toBe(401);
  });

  it("returns 401 when the Authorization header has the wrong token", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/generate-issue", { headers: { authorization: "Bearer wrong" } })
    );
    expect(response.status).toBe(401);
  });
});
