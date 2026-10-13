# Scheduled Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the spec's "working scheduled send (Monday 9am)" real. Today `triggerType: "scheduled"` exists only as a filter the Schedule Status screen displays — nothing ever produces one. This plan wires a Vercel Cron job that generates an issue on schedule, and (per Khoa's decision, 2026-10-13) stops short of auto-sending it: the generated issue lands in the dashboard as generated-but-unsent, same as any ad-hoc issue the operator doesn't immediately send, and a human still clicks Send.

**Architecture:** Vercel Cron's schedule granularity and your plan tier are both unknowns at plan-writing time, and a fixed UTC cron time can't track the PST/PDT transition anyway. So the cron entry fires **daily** (the one frequency every Vercel plan tier supports) at a fixed UTC time, and the route itself — not the cron schedule — decides whether generation is actually due, by computing "the most recent Monday 9am America/Los_Angeles at or before now" (the same DST-safe technique `nextScheduledRun` already uses for the *next* occurrence) and checking whether a scheduled issue already exists at or after that boundary. A daily check means generation happens within at most ~24h of the real 9am Monday boundary, not sub-minute — proportional to a demo-scale weekly cadence, not a production SLA.

This plan also closes a gap the cron feature would otherwise create: once an issue is generated without being sent, there's currently no way to send it *later* — the dashboard's Generate & Send screen only knows about an issue it just generated in the same browser session. This plan adds a Send action to the Issue Archive detail page for any issue that isn't sent yet, reusing Phase 4b's already-tested `sendIssue()`.

**Tech Stack:** Plain `vercel.json` for the cron entry — no new dependency. (The Vercel plugin's current guidance favors `vercel.ts`/`@vercel/config` for new projects, but this config has no dynamic logic or env-dependent branching, so a static JSON file is simpler and avoids a dependency for zero benefit here.)

**Spec:** [docs/superpowers/specs/2026-10-12-realty-pulse-newsletter-design.md](../specs/2026-10-12-realty-pulse-newsletter-design.md)

## Global Constraints

- Per Khoa's decision: the cron job generates only. It never calls `sendIssue`. The generated issue is `triggerType: "scheduled"`, `sentAt: null`, and becomes sendable from the dashboard like any other unsent issue.
- New env var `CRON_SECRET` (added to `src/lib/env.ts` and `.env.example`) — Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on its own cron invocations when that env var exists on the project; the route checks it to reject any other caller.
- The cron route reuses `createGenerateIssueDeps`/`generateIssue` (Phase 4b) exactly as the dashboard's `generateIssueAction` does, just with `triggerType: "scheduled"` and no human preview step first.
- Idempotency: the route must never generate two scheduled issues for the same week's boundary, regardless of how many times the daily cron (or a retry) invokes it that day.
- The Send-from-Archive addition reuses `sendIssue()` (Phase 4b) and the existing `ISSUE_EMAIL_SUBJECT` constant/pattern from `generate-actions.ts` — no new send logic, just a new entry point into the existing one.

## Review Focus

- A cron invocation on a day/time that isn't yet due (e.g. Tuesday, or Monday before 9am PT, *given this week's scheduled issue already exists*) must do nothing — no issue generated, no error. This deliberately does not apply when no scheduled issue exists yet at all (first deploy, or a prior week's run failed outright) — `shouldRunScheduledGeneration` treats that as due immediately on any day, which is the intended catch-up behavior a daily-frequency cron relies on, not a bug.
- A cron invocation without the correct `CRON_SECRET` bearer token must be rejected (401), never allowed to trigger generation.
- Two cron invocations within the same scheduled week (e.g. a Vercel retry, or the daily check firing again the next day before a human has acted) must not produce two scheduled issues for that week.
- The DST transition itself (so the "9am PT" boundary is computed correctly across the March/November changeover, not just working "most of the year") — covered by reusing `next-scheduled-run.ts`'s already-DST-tested offset logic, extended with its own tests for the new function.
- Sending a scheduled (or any previously-abandoned, generated-but-unsent) issue from the Archive must behave identically to sending one from the live Generate & Send wizard — same personalization, same already-sent guard, same partial-failure handling — not a second, divergent send path.

---

### Task 1: "Most recent scheduled run" + the run-now decision

**Files:**
- Modify: `src/lib/dashboard/next-scheduled-run.ts`
- Test: `src/lib/dashboard/next-scheduled-run.test.ts`
- Create: `src/lib/cron/should-run-scheduled-generation.ts`
- Test: `src/lib/cron/should-run-scheduled-generation.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `mostRecentScheduledRun(now: Date): Date`, `shouldRunScheduledGeneration(now: Date, lastScheduledIssueCreatedAt: Date | null): boolean` — both consumed by Task 2's cron route.

- [ ] **Step 1: Write the failing tests for `mostRecentScheduledRun`**

Add to `next-scheduled-run.test.ts`:

```ts
import { mostRecentScheduledRun } from "./next-scheduled-run";

describe("mostRecentScheduledRun", () => {
  it("returns this week's Monday 9am when now is a Wednesday", () => {
    const wednesday = new Date("2026-10-07T18:00:00Z");
    const result = mostRecentScheduledRun(wednesday);
    expect(result.getUTCDay()).toBe(1);
    expect(result.getTime()).toBeLessThan(wednesday.getTime());
  });

  it("returns today's run when now is Monday after 9am PT", () => {
    const mondayAfternoon = new Date("2026-10-12T22:00:00Z");
    const result = mostRecentScheduledRun(mondayAfternoon);
    const hoursAgo = (mondayAfternoon.getTime() - result.getTime()) / (60 * 60 * 1000);
    expect(hoursAgo).toBeLessThan(24);
  });

  it("returns last week's run when now is Monday before 9am PT", () => {
    const mondayMorning = new Date("2026-10-12T14:00:00Z"); // 7am PT Monday
    const result = mostRecentScheduledRun(mondayMorning);
    const daysAgo = (mondayMorning.getTime() - result.getTime()) / (24 * 60 * 60 * 1000);
    expect(daysAgo).toBeGreaterThan(6);
  });

  it("uses the PDT offset deep in daylight time", () => {
    const midJuly = new Date(Date.UTC(2026, 6, 15, 12, 0, 0));
    const result = mostRecentScheduledRun(midJuly);
    expect(result.getUTCHours()).toBe(16); // 9:00 AM PDT = 16:00 UTC
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/dashboard/next-scheduled-run.test.ts`
Expected: FAIL — `mostRecentScheduledRun` doesn't exist.

- [ ] **Step 3: Implement `mostRecentScheduledRun(now: Date): Date`**

Mirror `nextScheduledRun`'s structure: same `nowParts` extraction, but compute `daysSinceMonday = (currentWeekday - 1 + 7) % 7`, bumping to `daysSinceMonday += 7` when it's Monday (`daysSinceMonday === 0`) and `hour < 9` (today's boundary hasn't happened yet, so the most recent one was last week). Factor the shared "given Y/M/D, return 9am LA time as a real instant" math (currently inlined in `nextScheduledRun`) into a small private helper both functions call, to avoid duplicating the offset-lookup logic — the signature and return type of `nextScheduledRun` itself don't change.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/dashboard/next-scheduled-run.test.ts`
Expected: PASS, all tests (existing `nextScheduledRun` tests + new ones) — the refactor must not change `nextScheduledRun`'s behavior.

- [ ] **Step 5: Write the failing tests for `shouldRunScheduledGeneration`**

```ts
import { describe, it, expect } from "vitest";
import { shouldRunScheduledGeneration } from "./should-run-scheduled-generation";

describe("shouldRunScheduledGeneration", () => {
  it("returns true when no scheduled issue has ever been generated", () => {
    expect(shouldRunScheduledGeneration(new Date("2026-10-12T22:00:00Z"), null)).toBe(true);
  });

  it("returns false when the last scheduled issue was generated this week, at or after the boundary", () => {
    const now = new Date("2026-10-12T22:00:00Z"); // Monday afternoon
    const lastRun = new Date("2026-10-12T17:00:00Z"); // Monday 10am PT, this week's boundary
    expect(shouldRunScheduledGeneration(now, lastRun)).toBe(false);
  });

  it("returns true when the last scheduled issue predates this week's boundary", () => {
    const now = new Date("2026-10-12T22:00:00Z"); // Monday afternoon, this week
    const lastRun = new Date("2026-10-05T17:00:00Z"); // last week's run
    expect(shouldRunScheduledGeneration(now, lastRun)).toBe(true);
  });

  it("returns false on a day that isn't yet at this week's boundary", () => {
    const tuesday = new Date("2026-10-13T12:00:00Z");
    const lastRun = new Date("2026-10-12T17:00:00Z"); // generated yesterday, this week's run
    expect(shouldRunScheduledGeneration(tuesday, lastRun)).toBe(false);
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `pnpm test src/lib/cron/should-run-scheduled-generation.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 7: Implement `shouldRunScheduledGeneration(now: Date, lastScheduledIssueCreatedAt: Date | null): boolean`**

```ts
import { mostRecentScheduledRun } from "@/lib/dashboard/next-scheduled-run";

export function shouldRunScheduledGeneration(now: Date, lastScheduledIssueCreatedAt: Date | null): boolean {
  if (!lastScheduledIssueCreatedAt) return true;
  const boundary = mostRecentScheduledRun(now);
  return lastScheduledIssueCreatedAt.getTime() < boundary.getTime();
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `pnpm test src/lib/cron/should-run-scheduled-generation.test.ts`
Expected: PASS, all 4 tests.

- [ ] **Step 9: Commit**

```bash
git add src/lib/dashboard/next-scheduled-run.ts src/lib/dashboard/next-scheduled-run.test.ts src/lib/cron/should-run-scheduled-generation.ts src/lib/cron/should-run-scheduled-generation.test.ts
git commit -m "feat: add the scheduled-generation due-date decision"
```

---

### Task 2: Cron route

**Files:**
- Create: `src/app/api/cron/generate-issue/route.ts`
- Modify: `src/lib/env.ts`, `src/lib/env.test.ts`, `.env.example`
- Create: `vercel.json`

**Interfaces:**
- Consumes: `shouldRunScheduledGeneration` (Task 1), `createGenerateIssueDeps`/`generateIssue` (Phase 4b), `requireBearerToken` (Phase 2, `src/lib/mcp/server.ts` — already exported and tested; reused here rather than hand-rolling a second, untested bearer-token check).
- Produces: nothing consumed by a later task in this plan.

- [ ] **Step 1: Add `CRON_SECRET` to the env schema (TDD)**

In `env.test.ts`'s `REQUIRED` map, add `CRON_SECRET: "test"`. Run: `pnpm test src/lib/env.test.ts` — expect FAIL. In `env.ts`, add `CRON_SECRET: nonBlank` to the schema. In `.env.example`, add a `CRON_SECRET` entry with a comment that Vercel sets this automatically as the bearer token on its own cron invocations once the env var exists on the project. Run the test again — expect PASS.

- [ ] **Step 2: Implement the route**

```ts
import { NextResponse } from "next/server";
import { generateIssue } from "@/lib/content/generate-issue";
import { createGenerateIssueDeps } from "@/lib/content/pipeline-deps";
import { shouldRunScheduledGeneration } from "@/lib/cron/should-run-scheduled-generation";
import { requireBearerToken } from "@/lib/mcp/server";
import { getEnv } from "@/lib/env";

async function handler(): Promise<Response> {
  const env = getEnv();
  const deps = createGenerateIssueDeps(env);
  const issues = await deps.issueStore.listIssues();
  const lastScheduled = issues.find((issue) => issue.triggerType === "scheduled");

  if (!shouldRunScheduledGeneration(new Date(), lastScheduled ? new Date(lastScheduled.createdAt) : null)) {
    return NextResponse.json({ ran: false, reason: "Not due yet this week." });
  }

  try {
    const { issueId } = await generateIssue(deps, { triggerType: "scheduled" });
    return NextResponse.json({ ran: true, issueId });
  } catch (error) {
    return NextResponse.json(
      { ran: false, error: error instanceof Error ? error.message : "Generation failed." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request): Promise<Response> {
  return requireBearerToken(handler, getEnv().CRON_SECRET)(request);
}
```

`getEnv()` is called inside `GET`'s body, not at module top level — calling it at module-eval time would risk re-triggering the exact "missing env vars during the build's static-shell generation attempt" failure Phase 4a's ledger already hit once (see `next.config.ts`'s Cache Components comment). This matches `api/mcp/outbound/route.ts`'s existing, already-working `requireBearerToken(handler.fetch, getEnv().MCP_OUTBOUND_TOKEN)(request)` pattern exactly.

Reuses `requireBearerToken` (Phase 2) instead of a second, hand-rolled bearer check — its 401/missing-header/wrong-token/correct-token behavior is already covered by `server.test.ts`. No new test file for this route: beyond that reused auth check, it's thin orchestration over already-tested units (`shouldRunScheduledGeneration`, `generateIssue`), same treatment as `generate-actions.ts`.

- [ ] **Step 3: Write `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/cron/generate-issue", "schedule": "0 17 * * *" }
  ]
}
```

Daily at 17:00 UTC (9am PDT / 10am PST) — the universally-supported frequency across Vercel plan tiers. The route's own `shouldRunScheduledGeneration` check, not this schedule, is what keeps generation to once a week at the real Monday boundary.

- [ ] **Step 4: Typecheck and build**

Run: `pnpm typecheck && pnpm build`
Expected: clean; `/api/cron/generate-issue` appears in the route list as `ƒ (Dynamic)`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/generate-issue/route.ts src/lib/env.ts src/lib/env.test.ts .env.example vercel.json
git commit -m "feat: add the scheduled-generation cron route"
```

---

### Task 3: Send a previously-generated, unsent issue from the Archive

**Files:**
- Modify: `src/app/dashboard/archive/[id]/page.tsx`
- Create: `src/components/dashboard/send-issue-button.tsx`
- Test: `src/components/dashboard/send-issue-button.test.tsx`

**Interfaces:**
- Consumes: `sendIssueAction` (Phase 4b, `src/app/dashboard/generate-actions.ts` — already exported, no signature change).
- Produces: nothing consumed elsewhere — this is the plan's last task.

- [ ] **Step 1: Write the failing component tests**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SendIssueButton } from "./send-issue-button";

describe("SendIssueButton", () => {
  it("calls onSend with the issue id and shows the sent count on success", async () => {
    const onSend = vi.fn().mockResolvedValue({ sent: 42 });
    render(<SendIssueButton issueId="issue-1" subscriberCount={42} onSend={onSend} />);
    await userEvent.click(screen.getByRole("button", { name: /send to 42 subscribers/i }));
    expect(onSend).toHaveBeenCalledWith("issue-1");
    expect(await screen.findByText(/sent to 42 subscribers/i)).toBeInTheDocument();
  });

  it("shows an error and leaves the button clickable again if sending fails", async () => {
    const onSend = vi.fn().mockResolvedValue({ error: "This issue has already been sent." });
    render(<SendIssueButton issueId="issue-1" subscriberCount={42} onSend={onSend} />);
    await userEvent.click(screen.getByRole("button", { name: /send to 42 subscribers/i }));
    expect(await screen.findByText(/already been sent/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send to 42 subscribers/i })).toBeEnabled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/components/dashboard/send-issue-button.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `SendIssueButton({ issueId, subscriberCount, onSend }: { issueId: string; subscriberCount: number; onSend: (issueId: string) => Promise<{ sent: number } | { error: string }> })`**

`"use client"`. Same pending/try-catch-finally shape as `generate-and-send.tsx`'s `handleSend`. Button label `Send to {subscriberCount} subscribers`; on success show `Sent to {sent} subscribers` in place of the button; on error, show the error message and leave the button enabled for a retry.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/components/dashboard/send-issue-button.test.tsx`
Expected: PASS, both tests.

- [ ] **Step 5: Wire it into the Archive detail page**

In `archive/[id]/page.tsx`, after fetching `issue`, also fetch the live subscriber count the same way `dashboard/page.tsx` does (`connectOutboundMcpClient` + `listSubscribers().length`). When `!issue.sentAt`, render `<SendIssueButton issueId={issue.id} subscriberCount={subscribers.length} onSend={sendIssueAction} />` below the existing iframe preview; when `issue.sentAt` is set, render the existing "sent" information (or nothing extra — builder's call on exact placement, no behavior to test beyond the conditional itself, which Step 3's button already covers).

- [ ] **Step 6: Run the full suite**

Run: `pnpm check`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/archive/\[id\]/page.tsx src/components/dashboard/send-issue-button.tsx src/components/dashboard/send-issue-button.test.tsx
git commit -m "feat: allow sending a previously-generated, unsent issue from the Archive"
```

## Manual Verification (whole plan)

1. In the Vercel project dashboard (Khoa): confirm the project has a `CRON_SECRET` env var set (any random value — Vercel uses it automatically once `vercel.json` defines a cron hitting a route that checks it), matching the same value as local `.env` for local testing.
2. Deploy. Confirm the cron job appears in Vercel's Cron tab and fires on schedule.
3. Manually hit `/api/cron/generate-issue` locally with and without the correct `Authorization: Bearer $CRON_SECRET` header (e.g. via `curl`) to confirm the 401/success paths before relying on Vercel's own schedule.
4. After a scheduled issue is generated, confirm it shows up in Issue Archive as unsent, and that clicking Send from its detail page actually sends it and updates its status.
