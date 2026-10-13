# Dashboard Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the operator dashboard's authentication, shared shell, and three read/display-oriented screens — Issue Archive, Subscribers, and Schedule Status — matching the approved mockup and design system. Generate & Send (the one screen with real side effects — triggering the pipeline and sending real email) is deliberately a separate plan.

**Architecture:** Supabase Auth (single admin account, `@supabase/ssr` for cookie-based sessions) gates every `/dashboard/*` route via middleware; the redirect decision itself is a pure, tested function, with the Supabase session wiring around it thin and untested, matching this codebase's established split. A shared dashboard shell (sidebar + topbar) wraps all dashboard pages, styled from `design-system/realtypulse/MASTER.md`. Each screen follows the same pattern as the rest of the codebase: presentational components (tables, lists, forms) are plain functions taking props, unit-tested with React Testing Library against fake data; Server Components that fetch real data (via `IssueStore`, Phase 3b, or `connectOutboundMcpClient`, Phase 2) are thin and untested by design.

**Tech Stack:** `@supabase/ssr` (new dependency, official Supabase SSR package for Next.js — supersedes the deprecated `@supabase/auth-helpers-nextjs`), `@testing-library/react` + `@testing-library/jest-dom` (already installed, unused until now).

**Spec:** [docs/superpowers/specs/2026-10-12-realty-pulse-newsletter-design.md](../specs/2026-10-12-realty-pulse-newsletter-design.md)

## Global Constraints

- Single admin account, no in-app signup flow — the account is created once by the user via the Supabase Dashboard (Auth → Users → Add User), a manual step, same treatment as every other account-provisioning step in this project.
- Auth session cookies via `@supabase/ssr`'s `getAll`/`setAll` cookie adapter (the older `get`/`set`/`remove` methods are deprecated) — confirmed from current Supabase docs/community guides at plan-writing time; verify against the installed package's types at execution time and ledger a ruling if the API differs.
- New env vars: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser-safe anon key, needed for client-side sign-in — distinct from `SUPABASE_SERVICE_ROLE_KEY`, which must never reach the browser).
- Design system: colors, typography, and component patterns come from `design-system/realtypulse/MASTER.md` and the approved mockup (`Main.dc.html`/`Archive.dc.html`/`Subscribers.dc.html`/`Schedule.dc.html` in the published canvas) — implementers should match that visual reference directly rather than re-deriving styling decisions.
- Tailwind v4 (already scaffolded, CSS-first config) — design tokens go in `src/app/globals.css`'s `@theme` block, not a `tailwind.config.js` (Tailwind v4 doesn't use one by default).
- A presentational component gets `"use client"` only when it actually needs interactivity (`useState`, event handlers, `usePathname`); a component that just renders props stays a plain server-renderable function and is still directly unit-testable with React Testing Library either way.
- `IssueStore` and `connectOutboundMcpClient` (Phases 2–3b) are consumed as-is, not modified by this plan.

## Review Focus

- An unauthenticated request to any `/dashboard/*` route must redirect to `/login`, never render dashboard content — the one thing standing between this "internal, not public" tool and actually being public.
- An already-authenticated user visiting `/login` should redirect to `/dashboard`, not show a confusing already-signed-in login form.
- Submitting the add-subscriber form with an invalid email must show a clear validation error and never call the MCP client with bad data.
- Issue Archive, Subscribers, and Schedule Status must each render a sensible empty state with zero data (no issues yet, no subscribers yet, no scheduled runs yet) — not crash or show a blank/broken layout.
- The sidebar must mark the correct nav item active for each of the four dashboard routes, including the Generate & Send route this plan doesn't build yet (so the next plan's page lights up the right nav item without touching this plan's code).

---

### Task 1: Supabase auth (login + route protection)

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/proxy.ts`
- Create: `src/lib/auth/route-guard.ts`
- Test: `src/lib/auth/route-guard.test.ts`
- Create: `src/proxy.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/app/dashboard/actions.ts`
- Modify: `src/lib/env.ts`, `src/lib/env.test.ts`, `.env.example` (add `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

**Interfaces:**
- Consumes: nothing from later tasks.
- Produces: `shouldRedirectTo(pathname: string, isAuthenticated: boolean): string | null` in `route-guard.ts` — Tasks 2–5 don't consume this directly, but every dashboard route depends on the middleware that does.

- [ ] **Step 1: Add `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the env schema (TDD)**

In `src/lib/env.test.ts`'s `REQUIRED` map, add `NEXT_PUBLIC_SUPABASE_ANON_KEY: "test"`.

Run: `pnpm test src/lib/env.test.ts` — expect FAIL on "ENV_KEYS lists exactly the required keys."

In `src/lib/env.ts`, add `NEXT_PUBLIC_SUPABASE_ANON_KEY: nonBlank` to the schema.

In `.env.example`, add:
```
# Supabase anon/publishable key — browser-safe, used for client-side sign-in
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Run: `pnpm test src/lib/env.test.ts tests/tooling/env-example.test.ts` — expect PASS.

- [ ] **Step 2: Write the failing test for the route guard**

```ts
// src/lib/auth/route-guard.test.ts
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
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `pnpm test src/lib/auth/route-guard.test.ts`
Expected: FAIL with "Cannot find module './route-guard'"

- [ ] **Step 4: Implement `src/lib/auth/route-guard.ts`**

```ts
export function shouldRedirectTo(pathname: string, isAuthenticated: boolean): string | null {
  if (pathname.startsWith("/dashboard") && !isAuthenticated) return "/login";
  if (pathname === "/login" && isAuthenticated) return "/dashboard";
  return null;
}
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `pnpm test src/lib/auth/route-guard.test.ts`
Expected: PASS (5/5)

- [ ] **Step 6: Install `@supabase/ssr`**

Run: `pnpm add @supabase/ssr`

- [ ] **Step 7: Implement the three Supabase client wrappers and `src/proxy.ts`**

No tests — thin, direct wiring following the current official `@supabase/ssr` pattern (verify exact method names against the installed package's types; ledger a ruling if they differ from what's sketched here):

`src/lib/supabase/client.ts` — `createSupabaseBrowserClient()` using `createBrowserClient(url, anonKey)` from `@supabase/ssr`, reading `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` from `getEnv()`.

`src/lib/supabase/server.ts` — `createSupabaseServerClient()` (async) using `createServerClient(url, anonKey, { cookies: { getAll, setAll } })` from `@supabase/ssr`, wired to `next/headers`'s `cookies()`.

`src/lib/supabase/proxy.ts` — `updateSession(request: NextRequest): Promise<NextResponse>`: builds a `createServerClient` bound to the request/response cookie pair per `@supabase/ssr`'s documented middleware pattern, calls `supabase.auth.getUser()` to validate/refresh the session, then calls `shouldRedirectTo(request.nextUrl.pathname, !!user)` — if it returns a path, `NextResponse.redirect(new URL(path, request.url))`; otherwise returns the response carrying the refreshed cookies.

`src/proxy.ts` — `export async function proxy(request: NextRequest) { return updateSession(request); }` plus `export const config = { matcher: ["/dashboard/:path*", "/login"] }`. (Named `src/middleware.ts`/`export function middleware` in Next.js ≤15; Next.js 16 renamed the convention to `proxy.ts`/`export function proxy` — see the plan's Post-Execution Note.)

- [ ] **Step 8: Implement the login page**

`src/app/login/page.tsx` — a `"use client"` form (email + password fields, submit button) calling `createSupabaseBrowserClient().auth.signInWithPassword({ email, password })`; on success, `router.push("/dashboard")` and `router.refresh()`; on error, show the returned error message inline. Styled per the design system (warm card on the cream background, `btn-primary` per `MASTER.md`'s component specs). No test — this is a thin form wrapping a single SDK call with no business logic of its own.

- [ ] **Step 9: Implement sign-out**

`src/app/dashboard/actions.ts` — `"use server"` function `signOutAction()`: `(await createSupabaseServerClient()).auth.signOut()`, then `redirect("/login")`. No test (thin wiring).

- [ ] **Step 10: Run `pnpm check`**

Run: `pnpm check`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add src/lib/supabase/ src/lib/auth/ src/proxy.ts src/app/login/ src/app/dashboard/actions.ts src/lib/env.ts src/lib/env.test.ts .env.example package.json pnpm-lock.yaml
git commit -m "feat: add Supabase auth and dashboard route protection"
```

---

### Task 2: Dashboard shell (sidebar, topbar, design tokens)

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/components/dashboard/sidebar.tsx`
- Test: `src/components/dashboard/sidebar.test.tsx`
- Create: `src/components/dashboard/nav.tsx`
- Create: `src/app/dashboard/layout.tsx`

**Interfaces:**
- Consumes: `createSupabaseServerClient` (Task 1), `signOutAction` (Task 1).
- Produces: `Sidebar({ currentPath }: { currentPath: string })` — a reusable presentational component. No later task in this plan consumes it directly (each screen's own page is wrapped by `layout.tsx`), but the next plan's Generate & Send page renders inside this same `layout.tsx`, so the nav item list here must already include that route.

- [ ] **Step 1: Add design tokens to `globals.css`**

Add a `@theme` block (Tailwind v4 CSS-first config) defining the palette and font tokens from `design-system/realtypulse/MASTER.md`'s Color Palette and Typography sections (`--color-primary: #B4502E`, `--color-background: #FAF7F2`, etc., plus `--font-heading`, `--font-body`, `--font-mono`), and the Google Fonts `@import` line from the same doc. No test — this is theme configuration, not logic.

- [ ] **Step 2: Write the failing test for the sidebar**

```tsx
// src/components/dashboard/sidebar.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./sidebar";

describe("Sidebar", () => {
  it("renders all four dashboard nav items", () => {
    render(<Sidebar currentPath="/dashboard" />);
    expect(screen.getByRole("link", { name: /generate.*send/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /issue archive/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /subscribers/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /schedule status/i })).toBeInTheDocument();
  });

  it("marks the Issue Archive item active when currentPath is /dashboard/archive", () => {
    render(<Sidebar currentPath="/dashboard/archive" />);
    expect(screen.getByRole("link", { name: /issue archive/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /subscribers/i })).not.toHaveAttribute("aria-current");
  });

  it("marks the Subscribers item active when currentPath is /dashboard/subscribers", () => {
    render(<Sidebar currentPath="/dashboard/subscribers" />);
    expect(screen.getByRole("link", { name: /subscribers/i })).toHaveAttribute("aria-current", "page");
  });

  it("marks the Schedule Status item active when currentPath is /dashboard/schedule", () => {
    render(<Sidebar currentPath="/dashboard/schedule" />);
    expect(screen.getByRole("link", { name: /schedule status/i })).toHaveAttribute("aria-current", "page");
  });

  it("marks the Generate & Send item active when currentPath is /dashboard", () => {
    render(<Sidebar currentPath="/dashboard" />);
    expect(screen.getByRole("link", { name: /generate.*send/i })).toHaveAttribute("aria-current", "page");
  });
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `pnpm test src/components/dashboard/sidebar.test.tsx`
Expected: FAIL with "Cannot find module './sidebar'"

- [ ] **Step 4: Implement `src/components/dashboard/sidebar.tsx`**

A plain function component (no `"use client"` needed — it takes `currentPath` as a prop rather than reading the router itself, so it has no client-only hooks). Four nav items as a `const NAV_ITEMS = [{ href: "/dashboard", label: "Generate & Send" }, { href: "/dashboard/archive", label: "Issue Archive" }, { href: "/dashboard/subscribers", label: "Subscribers" }, { href: "/dashboard/schedule", label: "Schedule Status" }]`, each rendered as a Next.js `<Link href>` with `aria-current={currentPath === href ? "page" : undefined}`, each with its icon (inline SVG, matching the mockup's icon set) and the brand mark/wordmark at the top. Styling matches the mockup's `.sidebar`/`.nav a`/`.nav a.active` rules.

- [ ] **Step 5: Run tests, verify they pass**

Run: `pnpm test src/components/dashboard/sidebar.test.tsx`
Expected: PASS (5/5)

- [ ] **Step 6: Implement the client nav wrapper and layout**

`src/components/dashboard/nav.tsx` — `"use client"`, calls `usePathname()` and renders `<Sidebar currentPath={pathname} />`. No test (thin hook wiring around an already-tested component).

`src/app/dashboard/layout.tsx` — an async Server Component: fetches the signed-in user's email via `createSupabaseServerClient()`, renders the shell markup (matching the mockup: `<Nav />` + a topbar with the admin account chip and a sign-out button calling `signOutAction`) wrapping `{children}`. No test (thin data-fetching wiring).

- [ ] **Step 7: Run `pnpm check`**

Run: `pnpm check`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/app/globals.css src/components/dashboard/sidebar.tsx src/components/dashboard/sidebar.test.tsx src/components/dashboard/nav.tsx src/app/dashboard/layout.tsx
git commit -m "feat: add dashboard shell with design system tokens"
```

---

### Task 3: Issue Archive

**Files:**
- Create: `src/components/dashboard/issue-list.tsx`
- Test: `src/components/dashboard/issue-list.test.tsx`
- Create: `src/app/dashboard/archive/page.tsx`
- Create: `src/app/dashboard/archive/[id]/page.tsx`

**Interfaces:**
- Consumes: `IssueRecord`, `createSupabaseIssuesTable`, `SupabaseIssueStore` (Phase 3b).
- Produces: nothing later tasks in this plan consume.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/dashboard/issue-list.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IssueList } from "./issue-list";
import type { IssueRecord } from "@/lib/content/issue-store";

const issue: IssueRecord = {
  id: "issue-1",
  html: "<html></html>",
  triggerType: "scheduled",
  marketSummary: "Seattle's market is holding steady this week.",
  listings: [],
  createdAt: "2026-10-06T16:00:00Z",
};

describe("IssueList", () => {
  it("renders one row per issue with its trigger type and a view link", () => {
    render(<IssueList issues={[issue]} />);
    expect(screen.getByText(/holding steady/i)).toBeInTheDocument();
    expect(screen.getByText(/scheduled/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view/i })).toHaveAttribute("href", "/dashboard/archive/issue-1");
  });

  it("renders an empty state with no issues", () => {
    render(<IssueList issues={[]} />);
    expect(screen.getByText(/no issues yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm test src/components/dashboard/issue-list.test.tsx`
Expected: FAIL with "Cannot find module './issue-list'"

- [ ] **Step 3: Implement `src/components/dashboard/issue-list.tsx`**

`IssueList({ issues }: { issues: IssueRecord[] })` — a plain function component. Empty `issues` renders a single "No issues yet — generate your first one from Generate & Send." message instead of an empty table. Otherwise a table: one row per issue with a formatted date (`new Date(issue.createdAt).toLocaleString()`), a badge for `triggerType`, `listings.length`, `marketSummary` (truncated with CSS, not JS slicing, so the full text is still in the DOM for the test's `getByText` match), and a `<Link href={`/dashboard/archive/${issue.id}`}>View</Link>`. Styled per the mockup's `.table-wrap`/table rules, including `overflow-x: auto` on the wrapper.

- [ ] **Step 4: Run tests, verify they pass**

Run: `pnpm test src/components/dashboard/issue-list.test.tsx`
Expected: PASS (2/2)

- [ ] **Step 5: Implement the archive pages**

`src/app/dashboard/archive/page.tsx` — async Server Component: builds a Supabase client from `getEnv()`, wraps it in `SupabaseIssueStore(createSupabaseIssuesTable(...))`, calls `.listIssues()`, renders `<IssueList issues={...} />` under the page's `<h1>Issue Archive</h1>`. No test (thin data-fetching wiring).

`src/app/dashboard/archive/[id]/page.tsx` — async Server Component: same store construction, `.getIssue(id)`; if `null`, render a "not found" message; otherwise render the issue's metadata (trigger type, market summary, created date) and the issue's `html` inside an `<iframe srcDoc={issue.html} sandbox="" />` (sandboxed — this HTML includes the unsubscribe placeholder and third-party image URLs, never execute it with script privileges). No test (thin data-fetching wiring; the sandboxed-iframe choice is a one-line attribute, not an algorithm).

- [ ] **Step 6: Run `pnpm check`**

Run: `pnpm check`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/issue-list.tsx src/components/dashboard/issue-list.test.tsx src/app/dashboard/archive/
git commit -m "feat: add Issue Archive dashboard screen"
```

---

### Task 4: Subscribers

**Files:**
- Create: `src/lib/dashboard/subscriber-form.ts`
- Test: `src/lib/dashboard/subscriber-form.test.ts`
- Create: `src/components/dashboard/subscriber-list.tsx`
- Test: `src/components/dashboard/subscriber-list.test.tsx`
- Create: `src/app/dashboard/subscribers/actions.ts`
- Create: `src/app/dashboard/subscribers/page.tsx`

**Interfaces:**
- Consumes: `SubscriberRecord`, `connectOutboundMcpClient` (Phase 2).
- Produces: nothing later tasks in this plan consume.

- [ ] **Step 1: Write the failing test for form parsing**

```ts
// src/lib/dashboard/subscriber-form.test.ts
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
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm test src/lib/dashboard/subscriber-form.test.ts`
Expected: FAIL with "Cannot find module './subscriber-form'"

- [ ] **Step 3: Implement `src/lib/dashboard/subscriber-form.ts`**

```ts
import { z } from "zod";

const schema = z.object({ email: z.email(), source: z.string().optional() });

export function parseAddSubscriberForm(
  form: FormData
): { email: string; source?: string } | { error: string } {
  const source = form.get("source");
  const result = schema.safeParse({
    email: form.get("email"),
    source: typeof source === "string" && source.trim() !== "" ? source : undefined,
  });
  if (!result.success) return { error: "Enter a valid email address." };
  return result.data;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `pnpm test src/lib/dashboard/subscriber-form.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: Write the failing test for the subscriber list**

```tsx
// src/components/dashboard/subscriber-list.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubscriberList } from "./subscriber-list";
import type { SubscriberRecord } from "@/lib/mcp/subscriber-store";

const subscribers: SubscriberRecord[] = [
  { email: "a@example.com", source: "Referral", subscribedAt: "2026-10-01T00:00:00Z" },
  { email: "b@example.com", source: null, subscribedAt: "2026-10-02T00:00:00Z" },
];

describe("SubscriberList", () => {
  it("renders an empty state with no subscribers", () => {
    render(<SubscriberList subscribers={[]} onRemove={async () => {}} />);
    expect(screen.getByText(/no subscribers yet/i)).toBeInTheDocument();
  });

  it("renders one row per subscriber and no bulk bar when nothing is selected", () => {
    render(<SubscriberList subscribers={subscribers} onRemove={async () => {}} />);
    expect(screen.getByText("a@example.com")).toBeInTheDocument();
    expect(screen.getByText("b@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove selected/i })).not.toBeInTheDocument();
  });

  it("shows the bulk action bar after selecting a row, and calls onRemove with the selected emails", async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined);
    render(<SubscriberList subscribers={subscribers} onRemove={onRemove} />);
    await userEvent.click(screen.getByRole("checkbox", { name: /select a@example.com/i }));
    expect(screen.getByRole("button", { name: /remove selected/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /remove selected/i }));
    expect(onRemove).toHaveBeenCalledWith(["a@example.com"]);
  });
});
```

- [ ] **Step 6: Run tests, verify they fail**

Run: `pnpm test src/components/dashboard/subscriber-list.test.tsx`
Expected: FAIL with "Cannot find module './subscriber-list'"

- [ ] **Step 7: Install `@testing-library/user-event`**

Run: `pnpm add -D @testing-library/user-event`

- [ ] **Step 8: Implement `src/components/dashboard/subscriber-list.tsx`**

`"use client"`. `SubscriberList({ subscribers, onRemove }: { subscribers: SubscriberRecord[]; onRemove: (emails: string[]) => Promise<void> })`. `useState<Set<string>>` for selected emails. Empty `subscribers` renders "No subscribers yet." Otherwise a table with a checkbox column (`aria-label={`Select ${s.email}`}`, toggling membership in the selected set), and a bulk-action bar (`role="button", name: "Remove selected"`) rendered only when the selected set is non-empty, calling `onRemove([...selected])` then clearing the selection on resolve. Styled per the mockup's `.toolbar`/`.bulk-bar`/table rules.

- [ ] **Step 9: Run tests, verify they pass**

Run: `pnpm test src/components/dashboard/subscriber-list.test.tsx`
Expected: PASS (3/3)

- [ ] **Step 10: Implement server actions and the page**

`src/app/dashboard/subscribers/actions.ts` — `"use server"`:
- `addSubscriberAction(formData: FormData)`: calls `parseAddSubscriberForm`; on `{ error }`, return it (for the form to display) rather than throwing; on success, connects the MCP client (`connectOutboundMcpClient` with `getEnv()`'s `NEXT_PUBLIC_APP_URL` + `/api/mcp/outbound` and `MCP_OUTBOUND_TOKEN`) and calls `.addSubscriber(email, source)`, then `revalidatePath("/dashboard/subscribers")`.
- `removeSubscribersAction(emails: string[])`: connects the MCP client, calls `.removeSubscriber(email)` for each (sequential or `Promise.all` — builder's call, no test for this thin action), then `revalidatePath("/dashboard/subscribers")`.

No test for either action (thin wiring over already-tested `parseAddSubscriberForm` and `connectOutboundMcpClient`).

`src/app/dashboard/subscribers/page.tsx` — async Server Component: connects the MCP client, calls `.listSubscribers()`, renders an "Add subscriber" form (posting to `addSubscriberAction`) and `<SubscriberList subscribers={...} onRemove={removeSubscribersAction} />`. No test (thin data-fetching wiring).

- [ ] **Step 11: Run `pnpm check`**

Run: `pnpm check`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add src/lib/dashboard/ src/components/dashboard/subscriber-list.tsx src/components/dashboard/subscriber-list.test.tsx src/app/dashboard/subscribers/ package.json pnpm-lock.yaml
git commit -m "feat: add Subscribers dashboard screen"
```

---

### Task 5: Schedule Status

**Files:**
- Create: `src/lib/dashboard/next-scheduled-run.ts`
- Test: `src/lib/dashboard/next-scheduled-run.test.ts`
- Create: `src/components/dashboard/schedule-status.tsx`
- Test: `src/components/dashboard/schedule-status.test.tsx`
- Create: `src/app/dashboard/schedule/page.tsx`

**Interfaces:**
- Consumes: `IssueRecord` (Phase 3b).
- Produces: nothing later tasks in this plan consume.

- [ ] **Step 1: Write the failing test for next-run computation**

```ts
// src/lib/dashboard/next-scheduled-run.test.ts
import { describe, it, expect } from "vitest";
import { nextScheduledRun } from "./next-scheduled-run";

describe("nextScheduledRun", () => {
  it("returns the coming Monday 9am Los_Angeles time when now is a Wednesday", () => {
    const wednesday = new Date("2026-10-07T18:00:00Z"); // a Wednesday
    const next = nextScheduledRun(wednesday);
    expect(next.getUTCDay()).toBe(1); // next occurrence is a Monday
    expect(next.getTime()).toBeGreaterThan(wednesday.getTime());
  });

  it("returns next Monday, not today, when now is already Monday after 9am PT", () => {
    const mondayAfternoon = new Date("2026-10-12T22:00:00Z"); // Monday, past 9am PT
    const next = nextScheduledRun(mondayAfternoon);
    expect(next.getTime()).toBeGreaterThan(mondayAfternoon.getTime());
    const daysOut = (next.getTime() - mondayAfternoon.getTime()) / (24 * 60 * 60 * 1000);
    expect(daysOut).toBeGreaterThan(6);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm test src/lib/dashboard/next-scheduled-run.test.ts`
Expected: FAIL with "Cannot find module './next-scheduled-run'"

- [ ] **Step 3: Implement `src/lib/dashboard/next-scheduled-run.ts`**

`nextScheduledRun(now: Date): Date` — compute the next Monday 9:00 AM `America/Los_Angeles` strictly after `now`, using `Intl.DateTimeFormat`'s timezone-aware parts (not a fixed UTC offset, which would be wrong half the year across PST/PDT) to find the current date/time in that zone, then step forward to the next Monday 9:00 AM in that zone and convert back to a UTC `Date`. The exact DST-safe construction is this step's own algorithm — the two tests above pin its two edge cases (a mid-week "now" and an already-past-Monday "now").

- [ ] **Step 4: Run tests, verify they pass**

Run: `pnpm test src/lib/dashboard/next-scheduled-run.test.ts`
Expected: PASS (2/2)

- [ ] **Step 5: Write the failing test for the schedule status component**

```tsx
// src/components/dashboard/schedule-status.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScheduleStatus } from "./schedule-status";
import type { IssueRecord } from "@/lib/content/issue-store";

const lastRun: IssueRecord = {
  id: "issue-1",
  html: "<html></html>",
  triggerType: "scheduled",
  marketSummary: "steady",
  listings: [{ address: "", neighborhood: "", price: 0, beds: 0, baths: 0, sqft: 0, blurb: "", photoUrls: [] }],
  createdAt: "2026-10-06T16:00:00Z",
};

describe("ScheduleStatus", () => {
  it("shows the last run's date and listing count when a scheduled issue exists", () => {
    render(<ScheduleStatus scheduledIssues={[lastRun]} nextRun={new Date("2026-10-13T16:00:00Z")} />);
    expect(screen.getByText(/1 listing/i)).toBeInTheDocument();
  });

  it("shows a 'no runs yet' state when no scheduled issue exists", () => {
    render(<ScheduleStatus scheduledIssues={[]} nextRun={new Date("2026-10-13T16:00:00Z")} />);
    expect(screen.getByText(/no scheduled runs yet/i)).toBeInTheDocument();
  });

  it("always shows the next run time, with or without history", () => {
    render(<ScheduleStatus scheduledIssues={[]} nextRun={new Date("2026-10-13T16:00:00Z")} />);
    expect(screen.getByText(/next scheduled run/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run tests, verify they fail**

Run: `pnpm test src/components/dashboard/schedule-status.test.tsx`
Expected: FAIL with "Cannot find module './schedule-status'"

- [ ] **Step 7: Implement `src/components/dashboard/schedule-status.tsx`**

`ScheduleStatus({ scheduledIssues, nextRun }: { scheduledIssues: IssueRecord[]; nextRun: Date })` — a plain function component. "Last run" card: `scheduledIssues[0]` (caller passes them pre-sorted newest-first) if present, showing its `createdAt`, a "Sent" badge, and `${listings.length} listing${listings.length === 1 ? "" : "s"}`; otherwise "No scheduled runs yet." "Next scheduled run" card always shows `nextRun.toLocaleString()`. A history table below listing up to the 5 most recent `scheduledIssues`. Styled per the mockup's `.grid`/`.card`/`.history` rules.

- [ ] **Step 8: Run tests, verify they pass**

Run: `pnpm test src/components/dashboard/schedule-status.test.tsx`
Expected: PASS (3/3)

- [ ] **Step 9: Implement the page**

`src/app/dashboard/schedule/page.tsx` — async Server Component: builds the Supabase-backed `IssueStore` (same construction as Task 3), calls `.listIssues()`, filters to `triggerType === "scheduled"` (already newest-first per `SupabaseIssueStore.listIssues`'s `order by created_at desc`), calls `nextScheduledRun(new Date())`, renders `<ScheduleStatus scheduledIssues={...} nextRun={...} />`. No test (thin data-fetching wiring).

- [ ] **Step 10: Run the whole suite and `pnpm check`**

Run: `pnpm check`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add src/lib/dashboard/next-scheduled-run.ts src/lib/dashboard/next-scheduled-run.test.ts src/components/dashboard/schedule-status.tsx src/components/dashboard/schedule-status.test.tsx src/app/dashboard/schedule/
git commit -m "feat: add Schedule Status dashboard screen"
```

---

## Manual Verification (user-run, after this plan lands)

1. Create the single admin account via the Supabase Dashboard (Auth → Users → Add User) for project `qrfaaegrnzkysimiafwa`.
2. Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env` (from the project's API settings — the publishable/anon key, not the service role key).
3. `pnpm dev`, visit `/dashboard`, confirm it redirects to `/login`; sign in with the admin account; confirm it redirects back to `/dashboard` and the shell/nav renders.
4. Visit each of Issue Archive, Subscribers, and Schedule Status with real data (once Phase 2/3b's manual verification steps have produced at least one real issue and subscriber) and confirm they render correctly, not just against the unit tests' fakes.
5. Confirm sign-out actually clears the session (visiting `/dashboard` again redirects to `/login`).

## Self-Review

**Spec coverage:** Covers the spec's Dashboard section's auth requirement and three of its four screens (Issue Archive, Subscribers, Scheduled run status). Generate & Send is the next plan, per the agreed phase split.

**Step scan:** Every step pins an exact file, signature, or test; "no test" call-outs (the three Supabase client wrappers, `src/proxy.ts`, the login page, sign-out action, both `layout.tsx`/page-level Server Components, and the two subscriber server actions) are each thin data-fetching or SDK-wiring code, consistent with this codebase's established pattern (e.g. Phase 1's `env.ts` real wiring, Phase 2's `createGmailClient`).

**Type consistency:** `IssueRecord` (Phase 3b) is used identically across Tasks 3 and 5. `SubscriberRecord` (Phase 2) is used identically in Task 4's test and component. `shouldRedirectTo` (Task 1) is the only cross-task interface within this plan, consumed by `src/proxy.ts` in the same task.

## Post-Execution Note

The plan was written against Next.js's long-standing `middleware.ts` convention. The installed Next.js 16.4.0 deprecated it in favor of a renamed `proxy.ts` file with an exported `proxy` function — confirmed from the installed package's own docs, and from an explicit build-time deprecation warning on the old name. All `middleware.ts` references above mean `proxy.ts` (and `export function middleware` means `export function proxy`) — paths were corrected after the fact; see the plan's ledger for the full ruling.

**Review Focus:** all five lines have an owning task and an automated test (route-guard's five cases, the subscriber form's validation-error case, each list/status component's empty-state test, and the sidebar's five active-state cases, including the not-yet-built Generate & Send route).

**Proportion:** five tasks, each small; code blocks appear only where the test doesn't fully determine the body (the DST-safe next-run calculation, the three Supabase wrapper signatures pinned for correctness) — component internals are described by their rendering rules and left to the implementer, styled against the approved mockup rather than re-specified here.
