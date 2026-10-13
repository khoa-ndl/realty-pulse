# MCP Outbound Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the outbound integration layer as a real MCP server — `send_email`, `add_subscriber`, `list_subscribers`, `remove_subscriber` — with a default Gmail + Supabase implementation, so later phases (dashboard, signup) call these four tools through an MCP client instead of ever importing Gmail/Supabase directly.

**Architecture:** Two small adapters (`SubscriberStore` over Supabase, `EmailSender` over Gmail) sit behind their own interfaces so they're unit-testable against fakes. An MCP server (`@modelcontextprotocol/server`'s `McpServer`) registers the four tools against those interfaces and is mounted as a Next.js route via `createMcpHandler`, which produces a Web-standard `(Request) => Promise<Response>` handler — Streamable HTTP, not stdio, so it deploys on Vercel like any other route and "swap the provider" means pointing a different base URL at the same four tool names. A thin client wrapper (`connectOutboundMcpClient`) is what later phases actually import.

**Tech Stack:** `@modelcontextprotocol/server` + `@modelcontextprotocol/client` (official MCP TypeScript SDK v2), `@supabase/supabase-js`, `googleapis` (Gmail API, OAuth2), Zod (already a dependency).

**Spec:** [docs/superpowers/specs/2026-10-12-realty-pulse-newsletter-design.md](../specs/2026-10-12-realty-pulse-newsletter-design.md)

## Global Constraints

- Exactly four tools, these exact names: `send_email`, `add_subscriber`, `list_subscribers`, `remove_subscriber` — per spec.
- Default implementation: Gmail (send) + Supabase (subscriber store) — per spec Architecture section.
- MCP transport (builder's call, this plan): `@modelcontextprotocol/server`'s `createMcpHandler`, mounted at `src/app/api/mcp/outbound/route.ts`, Streamable HTTP — not stdio. Chosen because it deploys cleanly on Vercel's serverless Functions and makes the "bring your own stack" pitch literal (a different provider = a different base URL, same four tool names).
- Double opt-in / pending-subscriber state (Phase 5's scope) is explicitly out of scope here — `add_subscriber` adds an already-decided subscriber directly; Phase 5 owns any pending-confirmation state before it ever calls this tool.
- `remove_subscriber` soft-deletes (sets `unsubscribed_at`), never hard-deletes — preserves signup history for the spec's dashboard "signup source/date" requirement (builder's call).
- Supabase project `qrfaaegrnzkysimiafwa` (region us-west-2) is already provisioned. Applying `supabase/migrations/0001_subscribers.sql` is a manual step — paste it into the Supabase Dashboard's SQL Editor — not automated by any task below (no local Postgres/Docker available, and the generated DB password was never captured, by design — see the session's own note on credential handling).
- Gmail OAuth credentials (`GMAIL_CLIENT_ID`/`GMAIL_CLIENT_SECRET`/`GMAIL_REFRESH_TOKEN`) are obtained by the user following [docs/gmail-oauth-setup.md](../../gmail-oauth-setup.md) — also not automated.
- New dependencies, each the official first-party SDK for its service: `@modelcontextprotocol/server`, `@modelcontextprotocol/client`, `@supabase/supabase-js`, `googleapis`.

## Review Focus

- `add_subscriber` called for an email that's already actively subscribed (or was previously unsubscribed and is re-subscribing) must not error or create a duplicate row — covered by Task 1's upsert behavior and Task 3's end-to-end re-subscribe test.
- `remove_subscriber` called for an email that was never subscribed must be a no-op, not an error — covered by Task 3.
- Any tool called with invalid input (malformed email, missing field) must return a clear validation error from the tool itself (`isError: true`), never an unhandled exception that crashes the route — covered by Task 3's `wrapToolHandler` and its validation test.
- `send_email` when the Gmail API call fails must surface `isError: true` with a readable message, never silently report success or throw unhandled — covered by Task 3.
- `list_subscribers` must never return a subscriber who has been removed (`unsubscribed_at` set) — a stale address must not still receive sends later — covered by Task 1's `selectActive` filter and Task 3's end-to-end add/remove/list test.

---

### Task 1: Supabase subscriber store

**Files:**
- Create: `supabase/migrations/0001_subscribers.sql`
- Create: `src/lib/mcp/subscriber-store.ts`
- Test: `src/lib/mcp/subscriber-store.test.ts`

**Interfaces:**
- Consumes: nothing from earlier phases.
- Produces: `SubscriberRecord { email: string; source: string | null; subscribedAt: string }`; `SubscriberStore` (`addSubscriber(email: string, source?: string): Promise<void>`, `listSubscribers(): Promise<SubscriberRecord[]>`, `removeSubscriber(email: string): Promise<void>`); `SubscribersTable` (`upsertActive(email: string, source: string | null): Promise<void>`, `selectActive(): Promise<SubscriberRecord[]>`, `markUnsubscribed(email: string): Promise<void>`); `SupabaseSubscriberStore` (implements `SubscriberStore`, constructed with a `SubscribersTable`); `createSupabaseSubscribersTable(client: SupabaseClient): SubscribersTable`. Task 3 consumes `SubscriberStore` and `createSupabaseSubscribersTable`.

- [ ] **Step 1: Write the migration SQL**

`supabase/migrations/0001_subscribers.sql`:
```sql
create table subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);
```
This is schema-as-code, not app logic — no test exercises it locally (no Docker/Postgres available). Apply it manually via the Supabase Dashboard SQL Editor for project `qrfaaegrnzkysimiafwa` once this task is committed.

- [ ] **Step 2: Write the failing tests**

```ts
// src/lib/mcp/subscriber-store.test.ts
import { describe, it, expect, vi } from "vitest";
import { SupabaseSubscriberStore, type SubscribersTable } from "./subscriber-store";

function makeFakeTable(): SubscribersTable {
  return {
    upsertActive: vi.fn().mockResolvedValue(undefined),
    selectActive: vi.fn().mockResolvedValue([]),
    markUnsubscribed: vi.fn().mockResolvedValue(undefined),
  };
}

describe("SupabaseSubscriberStore", () => {
  it("addSubscriber delegates to table.upsertActive with email and source", async () => {
    const table = makeFakeTable();
    const store = new SupabaseSubscriberStore(table);
    await store.addSubscriber("a@example.com", "web");
    expect(table.upsertActive).toHaveBeenCalledWith("a@example.com", "web");
  });

  it("addSubscriber defaults source to null when omitted", async () => {
    const table = makeFakeTable();
    const store = new SupabaseSubscriberStore(table);
    await store.addSubscriber("a@example.com");
    expect(table.upsertActive).toHaveBeenCalledWith("a@example.com", null);
  });

  it("listSubscribers delegates to table.selectActive", async () => {
    const table = makeFakeTable();
    (table.selectActive as any).mockResolvedValue([{ email: "a@example.com", source: null, subscribedAt: "2026-01-01T00:00:00Z" }]);
    const store = new SupabaseSubscriberStore(table);
    await expect(store.listSubscribers()).resolves.toEqual([{ email: "a@example.com", source: null, subscribedAt: "2026-01-01T00:00:00Z" }]);
  });

  it("removeSubscriber delegates to table.markUnsubscribed", async () => {
    const table = makeFakeTable();
    const store = new SupabaseSubscriberStore(table);
    await store.removeSubscriber("a@example.com");
    expect(table.markUnsubscribed).toHaveBeenCalledWith("a@example.com");
  });
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `pnpm test src/lib/mcp/subscriber-store.test.ts`
Expected: FAIL with "Cannot find module './subscriber-store'"

- [ ] **Step 4: Install `@supabase/supabase-js`**

Run: `pnpm add @supabase/supabase-js`

- [ ] **Step 5: Implement `src/lib/mcp/subscriber-store.ts`**

The interfaces and `SupabaseSubscriberStore` from the Produces block above — each method is a one-line delegation to the injected `SubscribersTable` (`addSubscriber` passes `source ?? null`). Plus the real wiring, exact (no test covers this — it's thin, direct `@supabase/supabase-js` calls):

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseSubscribersTable(client: SupabaseClient): SubscribersTable {
  return {
    async upsertActive(email, source) {
      const { error } = await client
        .from("subscribers")
        .upsert({ email, source, subscribed_at: new Date().toISOString(), unsubscribed_at: null }, { onConflict: "email" });
      if (error) throw new Error(`Failed to upsert subscriber: ${error.message}`);
    },
    async selectActive() {
      const { data, error } = await client
        .from("subscribers")
        .select("email, source, subscribed_at")
        .is("unsubscribed_at", null);
      if (error) throw new Error(`Failed to list subscribers: ${error.message}`);
      return (data ?? []).map((row) => ({ email: row.email, source: row.source, subscribedAt: row.subscribed_at }));
    },
    async markUnsubscribed(email) {
      const { error } = await client
        .from("subscribers")
        .update({ unsubscribed_at: new Date().toISOString() })
        .eq("email", email);
      if (error) throw new Error(`Failed to unsubscribe: ${error.message}`);
    },
  };
}
```

- [ ] **Step 6: Run tests, verify they pass**

Run: `pnpm test src/lib/mcp/subscriber-store.test.ts`
Expected: PASS (4/4)

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0001_subscribers.sql src/lib/mcp/subscriber-store.ts src/lib/mcp/subscriber-store.test.ts package.json pnpm-lock.yaml
git commit -m "feat: add Supabase-backed subscriber store"
```

---

### Task 2: Gmail email sender

**Files:**
- Create: `src/lib/mcp/email-sender.ts`
- Test: `src/lib/mcp/email-sender.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `EmailSender` (`sendEmail(to: string, subject: string, html: string): Promise<void>`); `buildRawMimeMessage(opts: { to: string; subject: string; html: string }): string`; `GmailClient` (`sendRawMessage(raw: string): Promise<void>`); `GmailEmailSender` (implements `EmailSender`, constructed with a `GmailClient`); `createGmailClient(env: Pick<Env, "GMAIL_CLIENT_ID" | "GMAIL_CLIENT_SECRET" | "GMAIL_REFRESH_TOKEN">): GmailClient`. Task 3 consumes `EmailSender` and `createGmailClient`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/mcp/email-sender.test.ts
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
    const raw = (client.sendRawMessage as any).mock.calls[0][0];
    expect(decode(raw)).toContain("To: a@example.com");
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm test src/lib/mcp/email-sender.test.ts`
Expected: FAIL with "Cannot find module './email-sender'"

- [ ] **Step 3: Install `googleapis`**

Run: `pnpm add googleapis`

- [ ] **Step 4: Implement `src/lib/mcp/email-sender.ts`**

```ts
export function buildRawMimeMessage(opts: { to: string; subject: string; html: string }): string {
  const message = [
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    "Content-Type: text/html; charset=utf-8",
    "",
    opts.html,
  ].join("\r\n");
  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
```

`GmailEmailSender.sendEmail` builds the raw message via `buildRawMimeMessage` and awaits `this.client.sendRawMessage(raw)` — the signature and test fully determine this body.

The real wiring (no test covers this — thin, direct `googleapis` calls):

```ts
import { google } from "googleapis";
import type { Env } from "@/lib/env";

export function createGmailClient(env: Pick<Env, "GMAIL_CLIENT_ID" | "GMAIL_CLIENT_SECRET" | "GMAIL_REFRESH_TOKEN">): GmailClient {
  const oauth2Client = new google.auth.OAuth2(env.GMAIL_CLIENT_ID, env.GMAIL_CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: env.GMAIL_REFRESH_TOKEN });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  return {
    async sendRawMessage(raw) {
      await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
    },
  };
}
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `pnpm test src/lib/mcp/email-sender.test.ts`
Expected: PASS (2/2)

- [ ] **Step 6: Commit**

```bash
git add src/lib/mcp/email-sender.ts src/lib/mcp/email-sender.test.ts package.json pnpm-lock.yaml
git commit -m "feat: add Gmail-backed email sender"
```

---

### Task 3: Outbound MCP server, HTTP route, and client wrapper

**Files:**
- Create: `src/lib/mcp/server.ts`
- Create: `src/app/api/mcp/outbound/route.ts`
- Create: `src/lib/mcp/client.ts`
- Test: `src/lib/mcp/server.test.ts`

**Interfaces:**
- Consumes: `SubscriberStore` (Task 1), `createSupabaseSubscribersTable` (Task 1), `EmailSender` (Task 2), `createGmailClient` (Task 2), `getEnv` (Phase 1 scaffold).
- Produces: `createOutboundServer(store: SubscriberStore, sender: EmailSender): McpServer` in `server.ts`; `OutboundMcpClient` (`addSubscriber(email: string, source?: string): Promise<void>`, `listSubscribers(): Promise<SubscriberRecord[]>`, `removeSubscriber(email: string): Promise<void>`, `sendEmail(to: string, subject: string, html: string): Promise<void>`) and `connectOutboundMcpClient(baseUrl: string): Promise<OutboundMcpClient>` in `client.ts` — later phases (dashboard, signup) import only these, never `subscriber-store.ts` or `email-sender.ts` directly.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/mcp/server.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createOutboundServer } from "./server";
import { connectOutboundMcpClient, type OutboundMcpClient } from "./client";
import type { SubscriberStore, SubscriberRecord } from "./subscriber-store";
import type { EmailSender } from "./email-sender";

async function startTestServer(handler: (req: Request) => Promise<Response>) {
  const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers.set(key, value);
      else if (Array.isArray(value)) headers.set(key, value.join(", "));
    }
    const request = new Request(`http://localhost${req.url}`, { method: req.method, headers, body: body as any, duplex: "half" } as any);
    const response = await handler(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) {
      for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) res.write(chunk);
    }
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    baseUrl: `http://localhost:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function makeFakeStore() {
  const rows = new Map<string, SubscriberRecord>();
  const store: SubscriberStore = {
    async addSubscriber(email, source) {
      rows.set(email, { email, source: source ?? null, subscribedAt: new Date().toISOString() });
    },
    async listSubscribers() {
      return [...rows.values()];
    },
    async removeSubscriber(email) {
      rows.delete(email);
    },
  };
  return store;
}

function makeFakeSender() {
  let failNext = false;
  const sent: Array<{ to: string; subject: string; html: string }> = [];
  const sender: EmailSender = {
    async sendEmail(to, subject, html) {
      if (failNext) {
        failNext = false;
        throw new Error("Gmail API unavailable");
      }
      sent.push({ to, subject, html });
    },
  };
  return { sender, sent, failNext: () => (failNext = true) };
}

describe("outbound MCP server", () => {
  let baseUrl: string;
  let close: () => Promise<void>;
  let client: Client;
  let wrapper: OutboundMcpClient;
  let fakeSenderCtl: ReturnType<typeof makeFakeSender>;

  beforeAll(async () => {
    const store = makeFakeStore();
    fakeSenderCtl = makeFakeSender();
    const handler = createMcpHandler(() => createOutboundServer(store, fakeSenderCtl.sender));
    const started = await startTestServer(handler);
    baseUrl = started.baseUrl;
    close = started.close;
    client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(baseUrl)));
    wrapper = await connectOutboundMcpClient(baseUrl);
  });

  afterAll(async () => {
    await client.close();
    await close();
  });

  it("adds, lists, and removes a subscriber end to end", async () => {
    await client.callTool({ name: "add_subscriber", arguments: { email: "a@example.com", source: "web" } });
    const listed = await client.callTool({ name: "list_subscribers", arguments: {} });
    expect((listed.structuredContent as any).subscribers).toEqual([
      expect.objectContaining({ email: "a@example.com", source: "web" }),
    ]);
    await client.callTool({ name: "remove_subscriber", arguments: { email: "a@example.com" } });
    const after = await client.callTool({ name: "list_subscribers", arguments: {} });
    expect((after.structuredContent as any).subscribers).toEqual([]);
  });

  it("re-subscribing an already-active email does not duplicate it", async () => {
    await client.callTool({ name: "add_subscriber", arguments: { email: "b@example.com" } });
    await client.callTool({ name: "add_subscriber", arguments: { email: "b@example.com" } });
    const listed = await client.callTool({ name: "list_subscribers", arguments: {} });
    const matches = (listed.structuredContent as any).subscribers.filter((s: any) => s.email === "b@example.com");
    expect(matches).toHaveLength(1);
    await client.callTool({ name: "remove_subscriber", arguments: { email: "b@example.com" } });
  });

  it("removing a subscriber that was never added is a no-op", async () => {
    const result = await client.callTool({ name: "remove_subscriber", arguments: { email: "never@example.com" } });
    expect(result.isError).toBeFalsy();
  });

  it("rejects a malformed email with a validation error, not a crash", async () => {
    const result = await client.callTool({ name: "add_subscriber", arguments: { email: "not-an-email" } });
    expect(result.isError).toBe(true);
  });

  it("surfaces a Gmail failure as isError instead of throwing", async () => {
    fakeSenderCtl.failNext();
    const result = await client.callTool({ name: "send_email", arguments: { to: "c@example.com", subject: "Hi", html: "<p>hi</p>" } });
    expect(result.isError).toBe(true);
  });

  it("connectOutboundMcpClient throws a readable error when a tool reports isError", async () => {
    await expect(wrapper.addSubscriber("not-an-email")).rejects.toThrow();
  });

  it("connectOutboundMcpClient's listSubscribers returns plain SubscriberRecord objects", async () => {
    await wrapper.addSubscriber("d@example.com", "api");
    await expect(wrapper.listSubscribers()).resolves.toEqual([
      expect.objectContaining({ email: "d@example.com", source: "api" }),
    ]);
    await wrapper.removeSubscriber("d@example.com");
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm test src/lib/mcp/server.test.ts`
Expected: FAIL with "Cannot find module './server'" (and `./client`)

- [ ] **Step 3: Install `@modelcontextprotocol/server` and `@modelcontextprotocol/client`**

Run: `pnpm add @modelcontextprotocol/server @modelcontextprotocol/client`

- [ ] **Step 4: Implement `src/lib/mcp/server.ts`**

A `wrapToolHandler` helper so every tool's catch-and-report logic lives in one place (Review Focus: no tool handler may throw unhandled):

```ts
function wrapToolHandler<Args>(
  fn: (args: Args) => Promise<{ content: Array<{ type: "text"; text: string }>; structuredContent?: unknown }>
) {
  return async (args: Args) => {
    try {
      return await fn(args);
    } catch (err) {
      return { isError: true, content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }] };
    }
  };
}
```

`createOutboundServer(store, sender)` builds a `new McpServer({ name: "realty-pulse-outbound", version: "0.1.0" })` and registers the four tools via `server.registerTool(name, { description, inputSchema, outputSchema? }, wrapToolHandler(handler))`:

- `add_subscriber`: `inputSchema: z.object({ email: z.string().email(), source: z.string().optional() })`; handler calls `store.addSubscriber(email, source)`, returns `{ content: [{ type: "text", text: \`Subscribed ${email}\` }] }`.
- `list_subscribers`: `inputSchema: z.object({})`; `outputSchema: z.object({ subscribers: z.array(z.object({ email: z.string(), source: z.string().nullable(), subscribedAt: z.string() })) })`; handler calls `store.listSubscribers()`, returns `{ content: [...], structuredContent: { subscribers } }`.
- `remove_subscriber`: `inputSchema: z.object({ email: z.string().email() })`; handler calls `store.removeSubscriber(email)`.
- `send_email`: `inputSchema: z.object({ to: z.string().email(), subject: z.string().min(1), html: z.string().min(1) })`; handler calls `sender.sendEmail(to, subject, html)`.

Return the configured `server`.

- [ ] **Step 5: Implement `src/lib/mcp/client.ts`**

`OutboundMcpClient` and `connectOutboundMcpClient` from the Produces block. An `assertNotError(result)` helper throws `new Error(message)` (message = the first `text` content item, or a fallback string) when `result.isError` is true; each of the four wrapper methods calls the matching tool via `client.callTool({ name, arguments })` and passes the result through `assertNotError` before returning (for `listSubscribers`, returning `result.structuredContent.subscribers`).

- [ ] **Step 6: Implement `src/app/api/mcp/outbound/route.ts`**

No test covers this file — it is the thin, real production wiring the rest of this task's tests stand in for with fakes:

```ts
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createClient } from "@supabase/supabase-js";
import { createOutboundServer } from "@/lib/mcp/server";
import { createSupabaseSubscribersTable, SupabaseSubscriberStore } from "@/lib/mcp/subscriber-store";
import { createGmailClient, GmailEmailSender } from "@/lib/mcp/email-sender";
import { getEnv } from "@/lib/env";

const handler = createMcpHandler(() => {
  const env = getEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const store = new SupabaseSubscriberStore(createSupabaseSubscribersTable(supabase));
  const sender = new GmailEmailSender(createGmailClient(env));
  return createOutboundServer(store, sender);
});

export { handler as GET, handler as POST };
```

- [ ] **Step 7: Run tests, verify they pass**

Run: `pnpm test src/lib/mcp/server.test.ts`
Expected: PASS (7/7)

- [ ] **Step 8: Run the whole suite and `pnpm check`**

Run: `pnpm check`
Expected: PASS (lint, typecheck, full test suite, build)

- [ ] **Step 9: Commit**

```bash
git add src/lib/mcp/server.ts src/lib/mcp/client.ts src/lib/mcp/server.test.ts src/app/api/mcp/outbound/route.ts package.json pnpm-lock.yaml
git commit -m "feat: add outbound MCP server, HTTP route, and client wrapper"
```

---

## Manual Verification (user-run, after this plan lands)

Not automated — each needs an account action or a browser the agent doesn't have:

1. Apply `supabase/migrations/0001_subscribers.sql` via the Supabase Dashboard SQL Editor for project `qrfaaegrnzkysimiafwa`.
2. Follow [docs/gmail-oauth-setup.md](../../gmail-oauth-setup.md) to get `GMAIL_CLIENT_ID`/`GMAIL_CLIENT_SECRET`/`GMAIL_REFRESH_TOKEN`.
3. Copy `.env.example` to `.env` and fill in the Supabase URL/service role key (already known — see this session's own notes), the three Gmail values, and a `MCP_OUTBOUND_TOKEN` (generate with `openssl rand -hex 32`) — the final review added bearer-token auth to the route (see ledger), since an unauthenticated outbound-email/subscriber-dump endpoint was a Critical finding.
4. `pnpm dev`, then call `POST http://localhost:3000/api/mcp/outbound` with a real MCP client passing `Authorization: Bearer <MCP_OUTBOUND_TOKEN>` (or a one-off script using `connectOutboundMcpClient(url, token)`) to confirm `add_subscriber` writes a real row and `send_email` delivers a real message.

## Self-Review

**Spec coverage:** All four tools from the spec's Outbound Integration Layer section are implemented (Task 3), backed by the spec's named default implementation (Gmail + Supabase, Tasks 1–2). The spec's "swappable" requirement is met by the MCP boundary itself — a different provider means a different server behind the same four tool names, which this plan doesn't need to build (no second provider exists yet to swap to).

**Step scan:** Every step pins an exact file, signature, or test; the two "no test covers this" call-outs (Task 1 Step 5's `createSupabaseSubscribersTable`, Task 2 Step 4's `createGmailClient`, Task 3 Step 6's route) are each thin, direct third-party API wiring with no branching logic — exact copy, not an untested algorithm.

**Type consistency:** `SubscriberStore`/`SubscriberRecord` (Task 1) are used identically in Task 3's `createOutboundServer` signature and `server.test.ts`'s fakes. `EmailSender` (Task 2) likewise. `OutboundMcpClient`'s four methods match the four tool names exactly.

**Review Focus:** all five lines have an owning task and an automated test in `server.test.ts` (re-subscribe, no-op remove, validation error, Gmail failure, and the add/remove/list end-to-end test for the "never see a removed subscriber" line).

**Proportion:** three tasks; code blocks appear only for the two non-obvious algorithms (base64url MIME construction, the Node↔Fetch test bridge) and the real third-party wiring call-outs — tool registration and the client wrapper are described by signature and left to the implementer.
