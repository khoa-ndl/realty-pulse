# Generate & Send Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the dashboard's Generate & Send screen — the one screen with real side effects, per the approved design: a manual trigger for the whole content pipeline, a preview of the assembled email, and an explicit confirm-to-send action that emails every active subscriber.

**Architecture:** `generateIssue()` (Phase 3b) and the outbound MCP client (Phase 2) already exist but have never been wired to anything real. This plan adds the one missing piece — a factory assembling `GenerateIssueDeps` from real API clients — then two server actions (`generateIssueAction`, `sendIssueAction`) and a client-side three-state wizard component matching the approved mockup (`Main.dc.html` in the published "RealtyPulse Dashboard Mockups" canvas) exactly, with one deliberate deviation: the preview step renders the actual generated HTML in a sandboxed `<iframe>` (the pattern Phase 4a's Issue Archive detail page already established), not the mockup's hand-styled placeholder listing rows — showing the operator what will really be sent, reusing proven code, rather than a second static mockup of data that's now real.

This plan also closes a known gap from Phase 4a's final review: `generateIssue()` saves an issue to Supabase the moment it runs, before any send — so Issue Archive's "Generated" label was always true and never told the operator whether a send actually happened. This plan adds real sent-tracking (`sentAt` on `IssueRecord`, a migration, `IssueStore.markSent()`) and updates Issue Archive and Schedule Status to show true sent/unsent status.

**Tech Stack:** No new dependencies — assembles existing Phase 2/3b modules (`@anthropic-ai/sdk`, Perplexity/kie.ai `fetch` clients, `@supabase/supabase-js`, the MCP client) into one real pipeline for the first time.

**Spec:** [docs/superpowers/specs/2026-10-12-realty-pulse-newsletter-design.md](../specs/2026-10-12-realty-pulse-newsletter-design.md)

## Global Constraints

- `IssueStore`, `OutboundMcpClient`, and `generateIssue()` are consumed as-is (extended with `markSent`/`sentAt`, not otherwise modified) — matching this plan's predecessor's treatment of Phase 2/3b interfaces.
- No new environment variables — `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`, `KIE_AI_API_KEY`, `GMAIL_*`, `MCP_OUTBOUND_TOKEN`, `NEXT_PUBLIC_APP_URL`, and the Supabase keys are all already in `src/lib/env.ts`.
- Real wiring factories (e.g. `createGenerateIssueDeps`) are thin and untested by design, per this codebase's established convention (`CLAUDE.md`) — exercised by this plan's Manual Verification steps instead.
- Design: match `Main.dc.html`'s copy, layout, and colors exactly — three states (idle / preview / sent), same card/button/badge classes already established in `design-system/realtypulse/MASTER.md` and Phase 4a's components — except the preview area, which is a sandboxed `<iframe srcDoc={html}>` (same as `src/app/dashboard/archive/[id]/page.tsx`) inside the mockup's `.preview-frame` container, not the mockup's static listing rows.
- The Metro and Listings `<select>` controls stay exactly as mocked — a single fixed option each, decorative, not wired to anything. `generateIssueAction` always calls `generateIssue()` with its defaults (metro `"Seattle"`, `listingCount` `4`). Real multi-metro/listing-count support is out of scope for this plan.
- Email subject line is a fixed constant, `"RealtyPulse — Weekly Market Update"` — the spec and mockup don't call for anything more dynamic, and `IssueRecord` doesn't store a structured metro field to build one from.
- Double-send protection is UI-level only (the Send button disables while its action is pending) — no server-side idempotency lock. Proportional to a single-operator internal tool, matching this project's existing proportionality calls (e.g. Phase 4a's Cache Components ruling).
- New Supabase migration follows the existing `000N_<table>.sql` convention (`supabase/migrations/0001_subscribers.sql`, `0002_issues.sql`) → `0003_issues_sent_at.sql`.

## Review Focus

- A stored issue's HTML contains a literal `{{SUBSCRIBER_EMAIL}}` placeholder in its unsubscribe link (`src/lib/content/issue-template.ts`) — sending it unsubstituted ships a broken link to every recipient of every send. The substitution must happen per-recipient and URL-encode the email.
- Generation failing partway through the pipeline (research, copywriting, or image API error) must surface a visible, specific error on the idle screen and leave it retryable — not a blank crash, and not a half-saved issue (it isn't: `generateIssue` only calls `saveIssue` after every step succeeds).
- Sending with zero active subscribers must complete normally (send to nobody, mark the issue sent) — not error or hang on an empty list.
- A send action given an `issueId` that doesn't exist (e.g. deleted between generate and send) must return a clear error, not throw an unhandled exception.
- Issue Archive and Schedule Status must visibly distinguish a generated-but-never-sent issue from a sent one now that `sentAt` is tracked — clicking "Regenerate" on the dashboard leaves the abandoned first issue in the Archive, and it must not look identical to a real send.

---

### Task 1: Track real send status on issues

**Files:**
- Create: `supabase/migrations/0003_issues_sent_at.sql`
- Modify: `src/lib/content/issue-store.ts`
- Test: `src/lib/content/issue-store.test.ts`

**Interfaces:**
- Consumes: nothing from later tasks.
- Produces: `IssueRecord.sentAt: string | null`; `IssueStore.markSent(id: string): Promise<void>` — consumed by Task 3's `sendIssueAction` and Task 5's Archive/Schedule screens.

- [ ] **Step 1: Write the migration**

```sql
alter table issues add column sent_at timestamptz;
```

- [ ] **Step 2: Write the failing tests (TDD)**

In `issue-store.test.ts`, extend `makeFakeTable()` with `markSent: vi.fn().mockResolvedValue(undefined)`, and add:

```ts
it("saveIssue leaves a newly-created record with sentAt null", async () => {
  const table = makeFakeTable();
  table.selectById = vi.fn().mockResolvedValue({ ...sampleIssue, id: "issue-1", createdAt: "2026-01-01T00:00:00Z", sentAt: null });
  const store = new SupabaseIssueStore(table);
  const record = await store.getIssue("issue-1");
  expect(record?.sentAt).toBeNull();
});

it("markSent delegates to table.markSent", async () => {
  const table = makeFakeTable();
  const store = new SupabaseIssueStore(table);
  await store.markSent("issue-1");
  expect(table.markSent).toHaveBeenCalledWith("issue-1");
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test src/lib/content/issue-store.test.ts`
Expected: FAIL — `markSent` does not exist on `IssueStore`/`IssuesTable`, `sentAt` missing from the fake record shape.

- [ ] **Step 4: Implement**

In `issue-store.ts`:
- Add `sentAt: string | null` to `IssueRecord`.
- Add `markSent(id: string): Promise<void>` to `IssueStore` and `IssuesTable`.
- `SupabaseIssueStore.markSent` delegates to `this.table.markSent(id)`.
- `createSupabaseIssuesTable`'s returned object gets a `markSent` that runs `client.from("issues").update({ sent_at: new Date().toISOString() }).eq("id", id)`, throwing on `error` with the same `Failed to ...` message convention as its siblings.
- `rowToIssueRecord` adds `sentAt: (row.sent_at as string | null) ?? null`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test src/lib/content/issue-store.test.ts`
Expected: PASS, all tests.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0003_issues_sent_at.sql src/lib/content/issue-store.ts src/lib/content/issue-store.test.ts
git commit -m "feat: track real send status on issues"
```

---

### Task 2: Per-recipient unsubscribe-link personalization

**Files:**
- Create: `src/lib/content/personalize-issue.ts`
- Test: `src/lib/content/personalize-issue.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (pure string transform; the `{{SUBSCRIBER_EMAIL}}` placeholder comes from the already-existing `issue-template.ts`).
- Produces: `personalizeIssueHtml(html: string, email: string): string` — consumed by Task 3's `sendIssueAction`.

- [ ] **Step 1: Write the failing test**

```ts
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
    expect(personalizeIssueHtml(html, "x@y.com")).toBe("x%40y.com ... x%40y.com".replace(/x%40y.com/g, "x%40y.com"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/content/personalize-issue.test.ts`
Expected: FAIL with "Cannot find module './personalize-issue'".

- [ ] **Step 3: Implement `personalizeIssueHtml(html: string, email: string): string`**

`html.replaceAll("{{SUBSCRIBER_EMAIL}}", encodeURIComponent(email))`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/content/personalize-issue.test.ts`
Expected: PASS, both tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/personalize-issue.ts src/lib/content/personalize-issue.test.ts
git commit -m "feat: personalize each recipient's unsubscribe link"
```

---

### Task 3: Real pipeline wiring + Generate & Send server actions

**Files:**
- Create: `src/lib/content/pipeline-deps.ts`
- Create: `src/app/dashboard/generate-actions.ts`

**Interfaces:**
- Consumes: `GenerateIssueDeps`/`generateIssue` (Phase 3b), `createPerplexityResearcher`/`createClaudeCopywriter`/`createAnthropicMessageClient`/`createKieAiImageGenerator` (Phase 3a), `createSupabaseIssuesTable`/`SupabaseIssueStore`/`IssueStore.markSent` (Task 1), `OutboundMcpClient` (Phase 2), `personalizeIssueHtml` (Task 2), `requireUser` (Phase 4a).
- Produces: `generateIssueAction(): Promise<{ issueId: string; html: string } | { error: string }>`, `sendIssueAction(issueId: string): Promise<{ sent: number } | { error: string }>` — both consumed by Task 4's client component.

No test file for this task: `pipeline-deps.ts` is a real-client wiring factory (untested by design, per Global Constraints) and the two actions are thin orchestration over already-tested units (`generateIssue`, `personalizeIssueHtml`, `IssueStore`, `OutboundMcpClient`) with no new logic of their own — same treatment as `src/app/dashboard/subscribers/actions.ts`. Verified instead by this task's Manual Verification step and Task 4's component tests (which inject these actions as fakes).

- [ ] **Step 1: Implement `createGenerateIssueDeps(env: Env): GenerateIssueDeps` in `pipeline-deps.ts`**

Assembles real deps: `createPerplexityResearcher(env.PERPLEXITY_API_KEY)`, `createClaudeCopywriter(createAnthropicMessageClient(env.ANTHROPIC_API_KEY))`, `createKieAiImageGenerator(env.KIE_AI_API_KEY)`, `new SupabaseIssueStore(createSupabaseIssuesTable(createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)))`, `baseUrl: env.NEXT_PUBLIC_APP_URL`.

- [ ] **Step 2: Implement the two server actions in `generate-actions.ts`**

```ts
"use server";
```

`generateIssueAction()`: `await requireUser()`; build deps via `createGenerateIssueDeps(getEnv())`; call `generateIssue(deps, { triggerType: "manual" })` inside a try/catch — on success `revalidatePath("/dashboard/archive")` and return `{ issueId, html }`; on thrown error return `{ error: error instanceof Error ? error.message : "Generation failed." }` (Review Focus: generation failure surfaces, doesn't crash).

`sendIssueAction(issueId: string)`: `await requireUser()`; load the issue via the same `SupabaseIssueStore`/`createSupabaseIssuesTable` pair used elsewhere in the dashboard (`archive/[id]/page.tsx`'s pattern) — if `null`, return `{ error: "Issue not found." }` (Review Focus: missing issue — the `null`-vs-record branch itself is already covered by `issue-store.test.ts`'s existing `getIssue`/`selectById` tests from Phase 3b; this action adds no new logic on top of that branch, just the error-shaped return). Otherwise connect the MCP client (same `mcpClient()` helper pattern as `subscribers/actions.ts`), call `listSubscribers()`, and `Promise.all` a `sendEmail(sub.email, "RealtyPulse — Weekly Market Update", personalizeIssueHtml(issue.html, sub.email))` per subscriber (Review Focus: empty list — `Promise.all([])` on an empty `.map()` resolves to `[]` synchronously; this isn't a distinct code path, so it's covered by inspection rather than a dedicated test, same as `removeSubscribersAction`'s identical `Promise.all(emails.map(...))` over a possibly-empty array going untested today). Then `await store.markSent(issueId)`, `revalidatePath("/dashboard/archive")`, `revalidatePath("/dashboard/schedule")`, return `{ sent: subscribers.length }`.

- [ ] **Step 3: Typecheck and build**

Run: `pnpm typecheck && pnpm build`
Expected: clean — no new routes change the dynamic/static classification of any existing page.

- [ ] **Step 4: Commit**

```bash
git add src/lib/content/pipeline-deps.ts src/app/dashboard/generate-actions.ts
git commit -m "feat: wire the real content pipeline and add generate/send actions"
```

---

### Task 4: Generate & Send screen

**Files:**
- Create: `src/components/dashboard/generate-and-send.tsx`
- Test: `src/components/dashboard/generate-and-send.test.tsx`
- Modify: `src/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `generateIssueAction`/`sendIssueAction` (Task 3, injected as props — same presentational/thin-page split as `SubscriberList`/`subscribers/page.tsx`), `requireUser` (Phase 4a), `connectOutboundMcpClient`/`listSubscribers` (Phase 2, for the live subscriber count).
- Produces: `GenerateAndSend` component, replacing the Phase 4a placeholder `/dashboard` page.

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GenerateAndSend } from "./generate-and-send";

describe("GenerateAndSend", () => {
  it("starts idle and generates a preview on click", async () => {
    const onGenerate = vi.fn().mockResolvedValue({ issueId: "issue-1", html: "<html>preview</html>" });
    render(<GenerateAndSend subscriberCount={214} onGenerate={onGenerate} onSend={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /generate preview/i }));
    expect(onGenerate).toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: /send to 214 subscribers/i })).toBeInTheDocument();
  });

  it("shows a retryable error on the idle screen when generation fails, without advancing", async () => {
    const onGenerate = vi.fn().mockResolvedValue({ error: "Perplexity API error" });
    render(<GenerateAndSend subscriberCount={214} onGenerate={onGenerate} onSend={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /generate preview/i }));
    expect(await screen.findByText(/perplexity api error/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate preview/i })).toBeInTheDocument();
  });

  it("moves to the sent state after confirming send, and reports the real count", async () => {
    const onGenerate = vi.fn().mockResolvedValue({ issueId: "issue-1", html: "<html>preview</html>" });
    const onSend = vi.fn().mockResolvedValue({ sent: 214 });
    render(<GenerateAndSend subscriberCount={214} onGenerate={onGenerate} onSend={onSend} />);
    await userEvent.click(screen.getByRole("button", { name: /generate preview/i }));
    await userEvent.click(await screen.findByRole("button", { name: /send to 214 subscribers/i }));
    expect(onSend).toHaveBeenCalledWith("issue-1");
    expect(await screen.findByText(/sent to 214 subscribers/i)).toBeInTheDocument();
  });

  it("returns to idle on \"Generate another\" from the sent state", async () => {
    const onGenerate = vi.fn().mockResolvedValue({ issueId: "issue-1", html: "<html>preview</html>" });
    const onSend = vi.fn().mockResolvedValue({ sent: 214 });
    render(<GenerateAndSend subscriberCount={214} onGenerate={onGenerate} onSend={onSend} />);
    await userEvent.click(screen.getByRole("button", { name: /generate preview/i }));
    await userEvent.click(await screen.findByRole("button", { name: /send to 214 subscribers/i }));
    await userEvent.click(await screen.findByRole("button", { name: /generate another/i }));
    expect(screen.getByRole("button", { name: /generate preview/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/components/dashboard/generate-and-send.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `GenerateAndSend({ subscriberCount, onGenerate, onSend }: { subscriberCount: number; onGenerate: () => Promise<{ issueId: string; html: string } | { error: string }>; onSend: (issueId: string) => Promise<{ sent: number } | { error: string }> })`**

`"use client"`. `useState` for `step: "idle" | "preview" | "sent"`, `issue: { issueId: string; html: string } | null`, `sentCount: number | null`, `error: string | null`, `pending: boolean`. Match `Main.dc.html` exactly for copy, card/button classes, and the "can't be undone" note — except the preview card's body is `<iframe srcDoc={issue.html} sandbox="" title="Issue preview" className="h-[480px] w-full rounded-lg border-0" />` inside the mockup's `.preview-frame` div, in place of the mockup's static listing rows. Send button label and warning note interpolate `subscriberCount` (idle/preview) or `sentCount` (sent state). Buttons disable while `pending`; a failure from either action sets `error` and returns to/stays on the current step (never silently swallowed, never advances the step).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/components/dashboard/generate-and-send.test.tsx`
Expected: PASS, all 4 tests.

- [ ] **Step 5: Wire the real page**

Replace the Phase 4a stub in `src/app/dashboard/page.tsx`: `requireUser()`, connect the MCP client the same way `subscribers/page.tsx` does, `listSubscribers()` for the live count, render `<GenerateAndSend subscriberCount={subscribers.length} onGenerate={generateIssueAction} onSend={sendIssueAction} />`.

- [ ] **Step 6: Run the full suite**

Run: `pnpm check`
Expected: all green; `/dashboard` still classified `ƒ (Dynamic)`.

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/generate-and-send.tsx src/components/dashboard/generate-and-send.test.tsx src/app/dashboard/page.tsx
git commit -m "feat: build the Generate & Send screen"
```

---

### Task 5: Show real sent/unsent status in Issue Archive and Schedule Status

**Files:**
- Modify: `src/components/dashboard/issue-list.tsx`
- Test: `src/components/dashboard/issue-list.test.tsx`
- Modify: `src/components/dashboard/schedule-status.tsx`
- Test: `src/components/dashboard/schedule-status.test.tsx`

**Interfaces:**
- Consumes: `IssueRecord.sentAt` (Task 1).
- Produces: nothing consumed elsewhere — this is the plan's last task.

- [ ] **Step 1: Write the failing Issue Archive test**

Add to `issue-list.test.tsx`: render with one issue whose `sentAt` is `null` and one whose `sentAt` is a timestamp; assert the unsent row shows a "Not sent" badge and the sent row shows "Sent".

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/components/dashboard/issue-list.test.tsx`
Expected: FAIL — no status badge currently rendered.

- [ ] **Step 3: Add a Status column to `IssueList`**

New `<th>`/`<td>` rendering a badge: `issue.sentAt ? "Sent" : "Not sent"`, styled with the same success/muted badge classes `SubscriberList`'s "Active" badge and the Archive's trigger-type badge already use.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/components/dashboard/issue-list.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the failing Schedule Status test**

Add to `schedule-status.test.tsx`: render with a `lastRun` whose `sentAt` is `null` and assert the badge next to it reads "Not sent", not "Generated"; render with `sentAt` set and assert "Sent". Same for a row in the scheduled-runs table.

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm test src/components/dashboard/schedule-status.test.tsx`
Expected: FAIL — badge text is the hardcoded "Generated".

- [ ] **Step 7: Update `ScheduleStatus`'s two "Generated" badges**

Replace both hardcoded `"Generated"` badges with the same `sentAt ? "Sent" : "Not sent"` logic and badge-class convention as Step 3.

- [ ] **Step 8: Run test to verify it passes, then the full suite**

Run: `pnpm test src/components/dashboard/schedule-status.test.tsx` → PASS.
Run: `pnpm check` → all green.

- [ ] **Step 9: Commit**

```bash
git add src/components/dashboard/issue-list.tsx src/components/dashboard/issue-list.test.tsx src/components/dashboard/schedule-status.tsx src/components/dashboard/schedule-status.test.tsx
git commit -m "feat: show real sent/unsent status in Archive and Schedule Status"
```

---

## Manual Verification (whole plan)

After all tasks: apply the `0003_issues_sent_at.sql` migration to the Supabase project (Khoa, via the Supabase Dashboard's SQL editor — same manual-step treatment as every other account-provisioning step in this project), then with real `.env` values, `pnpm dev`, sign in, and on `/dashboard`:
1. Click "Generate Preview" — confirm a real preview renders (real market commentary, real listings, real photos) in the sandboxed iframe, not mockup placeholders.
2. Click "Send to N subscribers" — confirm the email actually arrives (check a real inbox) with a working, personalized unsubscribe link, and that the sent state shows the real count.
3. Check Issue Archive: the sent issue shows "Sent"; generate a second issue without sending it, and confirm it shows "Not sent".
4. Check Schedule Status: confirm its badges match the same sent/unsent truth.
