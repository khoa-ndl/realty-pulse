# Subscriber Signup & Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public signup half of the subscriber lifecycle the spec calls for ("a real signup flow for subscribers — public form, confirmation, unsubscribe"). Unsubscribe already exists; this plan adds the public `/subscribe` form and double opt-in email confirmation, so a client can sign themselves up without an operator touching the dashboard.

**Architecture:** Extends the existing `subscribers` table and `SubscriberStore`/`SubscribersTable` (Phase 2) with a confirmed/pending distinction, and extends the outbound MCP server (Phase 2) with two new tools (`add_pending_subscriber`, `confirm_subscriber`) so the public signup flow — like every other subscriber-store access in this app — goes through the MCP layer, not a direct Supabase call. `/subscribe` and `/confirm` are public pages (outside the proxy's auth matcher), matching `/unsubscribe`'s existing pattern.

**Tech Stack:** No new dependencies. Confirmation email uses the same plain-template-literal HTML approach as `issue-template.ts`, sent via the already-wired Gmail/MCP `send_email` tool.

**Spec:** [docs/superpowers/specs/2026-10-12-realty-pulse-newsletter-design.md](../specs/2026-10-12-realty-pulse-newsletter-design.md)

## Global Constraints

- Double opt-in, per Khoa's decision (2026-10-13): a public signup is stored as *pending* and does not count as an active subscriber — does not appear in `list_subscribers`, does not receive sends — until the confirmation link is clicked.
- The existing admin-dashboard "add subscriber" flow (`addSubscriberAction` → `add_subscriber` MCP tool → `upsertActive`) is unchanged: it stays immediately-active, no confirmation step. Only the new public path is pending-first.
- New migration: `subscribers` gains `confirmed_at timestamptz` (nullable; `null` = pending) and `confirmation_token text` (nullable, unique when set). Existing rows (all admin-added so far) are backfilled with `confirmed_at = subscribed_at` — they were already trusted/active and must not retroactively become pending.
- Token: `crypto.randomUUID()`, verified by a direct database match (not a signed/stateless token) — consistent with this project's scale, matching the simplicity of the rest of the outbound layer.
- To avoid leaking whether an email address is already subscribed, `/subscribe` shows the same "check your email" message whether a new pending row was created or the email was already active — no confirmation email is sent in the latter case.
- `/confirm` auto-confirms on page load (no manual confirm button) — unlike `/unsubscribe`'s deliberate confirm step, a prefetched confirm link causing an early confirmation isn't a meaningful harm: the person already requested it by submitting the signup form.
- `/subscribe` and `/confirm` are public, outside `src/proxy.ts`'s matcher (`["/dashboard/:path*", "/login"]` — already excludes anything not under those paths, no change needed there).

## Review Focus

- Submitting the signup form with an email that's already an active subscriber must not reset or un-confirm them, and must not trigger a second confirmation email — just the same generic success message.
- Submitting the signup form with an email that previously unsubscribed must put them back into *pending* state, not silently reactivate them without reconfirming.
- A confirm link with an invalid or already-used token must show a clear message, not crash or silently claim success.
- An unconfirmed (pending) signup must never appear in `list_subscribers` or receive a newsletter send, even though its row already exists in `subscribers`.
- The existing admin "add subscriber" dashboard flow must keep behaving exactly as before (immediately active, no confirmation) — this plan must not regress it.

---

### Task 1: Pending/confirmed tracking in the subscriber store

**Files:**
- Create: `supabase/migrations/0004_subscribers_confirmation.sql`
- Modify: `src/lib/mcp/subscriber-store.ts`
- Test: `src/lib/mcp/subscriber-store.test.ts`

**Interfaces:**
- Consumes: nothing from later tasks.
- Produces: `SubscriberStore.addPendingSubscriber(email: string, token: string, source?: string): Promise<"created" | "already-active">`, `SubscriberStore.confirmSubscriber(token: string): Promise<string | null>` — both consumed by Task 2's MCP tools.

- [ ] **Step 1: Write the migration**

```sql
alter table subscribers add column confirmed_at timestamptz;
alter table subscribers add column confirmation_token text;
create unique index subscribers_confirmation_token_key on subscribers (confirmation_token) where confirmation_token is not null;

-- Every subscriber added before this migration came through the trusted
-- admin-dashboard path — treat them as already confirmed, not pending.
update subscribers set confirmed_at = subscribed_at where confirmed_at is null;

alter table subscribers alter column confirmed_at set default now();
```

- [ ] **Step 2: Write the failing tests (TDD)**

In `subscriber-store.test.ts`, extend the fake `SubscribersTable` with `selectByEmail: vi.fn().mockResolvedValue(null)`, `insertPending: vi.fn().mockResolvedValue(undefined)`, `confirmByToken: vi.fn().mockResolvedValue(null)`. Add:

```ts
it("addPendingSubscriber inserts a pending row and returns \"created\" for a brand-new email", async () => {
  const table = makeFakeTable();
  const store = new SupabaseSubscriberStore(table);
  await expect(store.addPendingSubscriber("new@example.com", "tok-1")).resolves.toBe("created");
  expect(table.insertPending).toHaveBeenCalledWith("new@example.com", "tok-1", null);
});

it("addPendingSubscriber returns \"already-active\" and does not insert when the email is already an active subscriber", async () => {
  const table = makeFakeTable();
  table.selectByEmail = vi.fn().mockResolvedValue({ confirmedAt: "2026-01-01T00:00:00Z", unsubscribedAt: null });
  const store = new SupabaseSubscriberStore(table);
  await expect(store.addPendingSubscriber("active@example.com", "tok-2")).resolves.toBe("already-active");
  expect(table.insertPending).not.toHaveBeenCalled();
});

it("addPendingSubscriber treats a previously-unsubscribed email as a fresh pending signup", async () => {
  const table = makeFakeTable();
  table.selectByEmail = vi.fn().mockResolvedValue({ confirmedAt: "2026-01-01T00:00:00Z", unsubscribedAt: "2026-02-01T00:00:00Z" });
  const store = new SupabaseSubscriberStore(table);
  await expect(store.addPendingSubscriber("backagain@example.com", "tok-3")).resolves.toBe("created");
  expect(table.insertPending).toHaveBeenCalledWith("backagain@example.com", "tok-3", null);
});

it("confirmSubscriber delegates to table.confirmByToken", async () => {
  const table = makeFakeTable();
  vi.mocked(table.confirmByToken).mockResolvedValue("confirmed@example.com");
  const store = new SupabaseSubscriberStore(table);
  await expect(store.confirmSubscriber("tok-4")).resolves.toBe("confirmed@example.com");
});

it("confirmSubscriber returns null for an invalid or already-used token", async () => {
  const table = makeFakeTable();
  const store = new SupabaseSubscriberStore(table);
  await expect(store.confirmSubscriber("bad-token")).resolves.toBeNull();
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test src/lib/mcp/subscriber-store.test.ts`
Expected: FAIL — `addPendingSubscriber`/`confirmSubscriber` don't exist on `SupabaseSubscriberStore`.

- [ ] **Step 4: Implement**

In `subscriber-store.ts`:
- `SubscribersTable` gains `selectByEmail(email: string): Promise<{ confirmedAt: string | null; unsubscribedAt: string | null } | null>`, `insertPending(email: string, token: string, source: string | null): Promise<void>`, `confirmByToken(token: string): Promise<string | null>`.
- `SubscriberStore` gains `addPendingSubscriber(email: string, token: string, source?: string): Promise<"created" | "already-active">` and `confirmSubscriber(token: string): Promise<string | null>`.
- `SupabaseSubscriberStore.addPendingSubscriber`: calls `this.table.selectByEmail(email)`; if the result has both `confirmedAt` set and `unsubscribedAt` null, return `"already-active"` without inserting. Otherwise `await this.table.insertPending(email, token, source ?? null)` and return `"created"`.
- `SupabaseSubscriberStore.confirmSubscriber`: delegates to `this.table.confirmByToken(token)`.
- `createSupabaseSubscribersTable`'s `selectActive` query adds `.not("confirmed_at", "is", null)` alongside the existing `.is("unsubscribed_at", null)`.
- `selectByEmail`: `select("confirmed_at, unsubscribed_at").eq("email", email).maybeSingle()`, mapped to camelCase, `null` if no row.
- `insertPending`: `upsert({ email, source, confirmed_at: null, confirmation_token: token, unsubscribed_at: null }, { onConflict: "email" })` — explicitly passing `confirmed_at: null` overrides the column's `now()` default and overwrites any prior unsubscribed/confirmed state, which is exactly the Task's Global Constraint for a previously-unsubscribed email re-signing-up.
- `confirmByToken`: `update({ confirmed_at: new Date().toISOString(), confirmation_token: null }).eq("confirmation_token", token).select("email").maybeSingle()`, returning `data?.email ?? null`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test src/lib/mcp/subscriber-store.test.ts`
Expected: PASS, all tests (existing + new).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0004_subscribers_confirmation.sql src/lib/mcp/subscriber-store.ts src/lib/mcp/subscriber-store.test.ts
git commit -m "feat: add pending/confirmed tracking to the subscriber store"
```

---

### Task 2: MCP tools + outbound client methods

**Files:**
- Modify: `src/lib/mcp/server.ts`
- Modify: `src/lib/mcp/client.ts`

**Interfaces:**
- Consumes: `SubscriberStore.addPendingSubscriber`/`confirmSubscriber` (Task 1).
- Produces: `OutboundMcpClient.addPendingSubscriber(email: string, token: string, source?: string): Promise<"created" | "already-active">`, `OutboundMcpClient.confirmSubscriber(token: string): Promise<string | null>` — consumed by Task 4/5's server actions.

No test file for this task: both additions are thin registration/delegation over the already-tested `SubscriberStore` methods (Task 1) and the MCP transport plumbing itself (`assertNotError`, tool call marshaling) is already covered by the existing `add_subscriber`/`remove_subscriber` tools' tests — same treatment as this codebase's other thin wiring. Verified by this task's typecheck/build step and exercised end-to-end by Task 4/5's action tests.

- [ ] **Step 1: Add the two tools to `createOutboundServer` in `server.ts`**

```ts
server.registerTool(
  "add_pending_subscriber",
  {
    description: "Register a pending subscriber who must confirm via email before receiving sends",
    inputSchema: z.object({ email: normalizedEmail, source: z.string().optional(), token: z.string().min(1) }),
    outputSchema: z.object({ status: z.enum(["created", "already-active"]) }),
  },
  wrapToolHandler(async ({ email, source, token }) => {
    const status = await store.addPendingSubscriber(email, token, source);
    return { content: [{ type: "text", text: status }], structuredContent: { status } };
  })
);

server.registerTool(
  "confirm_subscriber",
  {
    description: "Confirm a pending subscriber using their confirmation token",
    inputSchema: z.object({ token: z.string().min(1) }),
    outputSchema: z.object({ email: z.string().nullable() }),
  },
  wrapToolHandler(async ({ token }) => {
    const email = await store.confirmSubscriber(token);
    return { content: [{ type: "text", text: email ? `Confirmed ${email}` : "Invalid or expired token" }], structuredContent: { email } };
  })
);
```

- [ ] **Step 2: Add the two methods to `OutboundMcpClient` and `connectOutboundMcpClient` in `client.ts`**

```ts
async addPendingSubscriber(email, token, source) {
  const result = await client.callTool({ name: "add_pending_subscriber", arguments: { email, token, source } });
  assertNotError(result);
  return (result.structuredContent as { status: "created" | "already-active" }).status;
},
async confirmSubscriber(token) {
  const result = await client.callTool({ name: "confirm_subscriber", arguments: { token } });
  assertNotError(result);
  return (result.structuredContent as { email: string | null }).email;
},
```

- [ ] **Step 3: Typecheck and build**

Run: `pnpm typecheck && pnpm build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/mcp/server.ts src/lib/mcp/client.ts
git commit -m "feat: add pending-subscriber MCP tools"
```

---

### Task 3: Confirmation email template

**Files:**
- Create: `src/lib/content/confirmation-email.ts`
- Test: `src/lib/content/confirmation-email.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `renderConfirmationEmailHtml(confirmUrl: string): string` — consumed by Task 4's `subscribeAction`.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/content/confirmation-email.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `renderConfirmationEmailHtml(confirmUrl: string): string`**

Plain template-literal HTML matching `issue-template.ts`'s branded-header style (RealtyPulse masthead, one paragraph, one button/link to `confirmUrl`). Reuse that file's `escapeAttr` helper if convenient, or a local copy — builder's call, same escaping behavior either way.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/content/confirmation-email.test.ts`
Expected: PASS, both tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/confirmation-email.ts src/lib/content/confirmation-email.test.ts
git commit -m "feat: add the confirmation email template"
```

---

### Task 4: Public /subscribe page

**Files:**
- Create: `src/app/subscribe/actions.ts`
- Create: `src/app/subscribe/page.tsx`
- Create: `src/components/subscribe-card.tsx`
- Test: `src/components/subscribe-card.test.tsx`

**Interfaces:**
- Consumes: `OutboundMcpClient.addPendingSubscriber` (Task 2), `renderConfirmationEmailHtml` (Task 3).
- Produces: nothing consumed by a later task in this plan.

- [ ] **Step 1: Write the failing component tests**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubscribeCard } from "./subscribe-card";

describe("SubscribeCard", () => {
  it("submits the entered email and shows the same success message on success", async () => {
    const onSubscribe = vi.fn().mockResolvedValue({ success: true });
    render(<SubscribeCard onSubscribe={onSubscribe} />);
    await userEvent.type(screen.getByLabelText(/email/i), "a@example.com");
    await userEvent.click(screen.getByRole("button", { name: /subscribe/i }));
    expect(onSubscribe).toHaveBeenCalledWith("a@example.com");
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });

  it("shows a validation error for an invalid email without calling onSubscribe", async () => {
    const onSubscribe = vi.fn();
    render(<SubscribeCard onSubscribe={onSubscribe} />);
    await userEvent.type(screen.getByLabelText(/email/i), "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: /subscribe/i }));
    expect(onSubscribe).not.toHaveBeenCalled();
  });

  it("shows the same success message even when onSubscribe reports the email was already active", async () => {
    const onSubscribe = vi.fn().mockResolvedValue({ success: true });
    render(<SubscribeCard onSubscribe={onSubscribe} />);
    await userEvent.type(screen.getByLabelText(/email/i), "already@example.com");
    await userEvent.click(screen.getByRole("button", { name: /subscribe/i }));
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/components/subscribe-card.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `SubscribeCard({ onSubscribe }: { onSubscribe: (email: string) => Promise<{ success: true } | { error: string }> })`**

`"use client"`. An email `<input type="email" required>` with a visible `<label>`; client-side `type="email"` + `required` is enough to cover the invalid-email case (the browser blocks submission, so `onSubscribe` is never called — no separate validation function needed). On submit, call `onSubscribe(email)`; regardless of the result being `{ success: true }` or an email-already-active case folded into the same success shape by the action (see Task's Interfaces — `subscribeAction` always resolves `{ success: true }` unless something actually throws), show "Check your email to confirm your subscription." Only an actual `{ error }` (e.g. a thrown MCP/network failure) shows an error message instead.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/components/subscribe-card.test.tsx`
Expected: PASS, all 3 tests.

- [ ] **Step 5: Implement `subscribeAction(email: string)` in `actions.ts`**

```ts
"use server";
```

No `requireUser()` — this is a public action. Generates `const token = crypto.randomUUID()`. Connects the MCP client (same `${env.NEXT_PUBLIC_APP_URL}/api/mcp/outbound` + `MCP_OUTBOUND_TOKEN` pattern as every other action). Calls `client.addPendingSubscriber(email, token, "public-signup")`. If the result is `"created"`, send the confirmation email via `client.sendEmail(email, "Confirm your RealtyPulse subscription", renderConfirmationEmailHtml(`${env.NEXT_PUBLIC_APP_URL}/confirm?token=${token}`))`. If `"already-active"`, send nothing. Either way, return `{ success: true }` (Global Constraint: don't leak which case happened). Wrap in try/catch returning `{ error: ... }` on an unexpected throw, matching every other action in this codebase.

- [ ] **Step 6: Implement the page**

`src/app/subscribe/page.tsx`: same centered-card full-page layout as `/login`/`/unsubscribe`, rendering `<SubscribeCard onSubscribe={subscribeAction} />`.

- [ ] **Step 7: Run the full suite**

Run: `pnpm check`
Expected: all green; `/subscribe` classified `ƒ (Dynamic)` (it's a server action page, same as `/unsubscribe`) or `○ (Static)` if Next can prerender its shell — either is fine, there's no per-request data read on initial load.

- [ ] **Step 8: Commit**

```bash
git add src/app/subscribe/actions.ts src/app/subscribe/page.tsx src/components/subscribe-card.tsx src/components/subscribe-card.test.tsx
git commit -m "feat: build the public subscribe page"
```

---

### Task 5: Public /confirm page

**Files:**
- Create: `src/app/confirm/actions.ts`
- Create: `src/app/confirm/page.tsx`

**Interfaces:**
- Consumes: `OutboundMcpClient.confirmSubscriber` (Task 2).
- Produces: nothing consumed elsewhere — this is the plan's last task.

- [ ] **Step 1: Implement `confirmAction(token: string): Promise<string | null>` in `actions.ts`**

```ts
"use server";
```

No `requireUser()`. Connects the MCP client, calls `client.confirmSubscriber(token)`, returns the email or `null` directly (no try/catch needed beyond what the page itself handles — an unexpected throw here is a genuine 500, acceptable for this low-stakes, no-side-effect-on-failure read).

- [ ] **Step 2: Implement the page**

`src/app/confirm/page.tsx`: a server component (no client component needed — auto-confirms on load per Global Constraints, no button). Reads `?token=` from `searchParams`; if missing, render "This confirmation link is invalid." without calling the action. Otherwise call `confirmAction(token)` directly during render and show "You're confirmed! You'll receive RealtyPulse's weekly updates at `<email>`." or, if `null`, "This confirmation link is invalid or has already been used." Same centered-card layout as the other public pages.

- [ ] **Step 3: Run the full suite**

Run: `pnpm check`
Expected: all green; `/confirm` classified `ƒ (Dynamic)` (reads `searchParams`).

- [ ] **Step 4: Commit**

```bash
git add src/app/confirm/actions.ts src/app/confirm/page.tsx
git commit -m "feat: build the public confirm page"
```

## Manual Verification (whole plan)

After all tasks, apply `0004_subscribers_confirmation.sql` to the Supabase project (Khoa, via the Supabase Dashboard's SQL editor — same manual step as every other migration in this project). With real `.env` values, `pnpm dev`:
1. Visit `/subscribe`, submit a real email you can check. Confirm you receive the confirmation email and that the email does NOT yet appear in the dashboard's Subscribers list.
2. Click the confirmation link. Confirm it now appears in Subscribers, and that re-visiting the same confirm link a second time shows "invalid or already used."
3. Submit `/subscribe` again with the same (now-active) email. Confirm you do NOT receive a second confirmation email, and the page still shows the same "check your email" message.
