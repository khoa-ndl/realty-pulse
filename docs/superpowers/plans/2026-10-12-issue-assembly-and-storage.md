# Issue Assembly and Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compose Phase 3a's four building blocks (listing generator, market researcher, copywriter, image generator) into an actual newsletter issue — rendered branded HTML, stored in Supabase for the dashboard archive — finishing Phase 3's pipeline steps 5 and 6 from the spec.

**Architecture:** A pure `renderIssueHtml` function turns assembled content into branded HTML (no I/O, fully testable without fakes). An `IssueStore`/`IssuesTable` pair persists issues to Supabase, mirroring Phase 2's `SubscriberStore`/`SubscribersTable` split. A `generateIssue` orchestrator calls the four Phase 3a building blocks (injected by interface, as established), renders the HTML, and saves it — this is the function Phase 4's "Generate & Send" button and Phase 5's cron job will both call. Actually sending the rendered HTML to subscribers (looping over the subscriber list, calling the outbound MCP layer's `send_email`) is explicitly **not** this plan's job — that belongs to whichever later phase triggers a send.

**Tech Stack:** No new external dependencies — `@supabase/supabase-js` (already installed) for storage; the HTML template is hand-rolled (table-based, inline styles), not a new templating library.

**Spec:** [docs/superpowers/specs/2026-10-12-realty-pulse-newsletter-design.md](../specs/2026-10-12-realty-pulse-newsletter-design.md)

## Global Constraints

- Issues are stored in a single `issues` table with each issue's listings as a `jsonb` column, not a separate join table — this phase has no need to query listings independently of their issue (builder's call; revisit if a later phase needs per-listing queries across issues).
- Email HTML templating approach (builder's call, per spec's own delegation): hand-rolled template-literal HTML with inline styles and a table-based layout for email-client compatibility, not `react-email` or MJML — simplest sufficient choice for one template, avoids a new dependency.
- The rendered HTML's unsubscribe link carries a literal `{{SUBSCRIBER_EMAIL}}` placeholder token, substituted by whichever later phase actually sends to a specific subscriber — one assembled/stored issue is reused across every recipient, so per-recipient personalization can't happen at render time.
- New env var `NEXT_PUBLIC_APP_URL` (the app's own public base URL, used to build the absolute unsubscribe link) — added to `src/lib/env.ts`/`.env.example` in Task 2, following the pattern Phase 2 established for `MCP_OUTBOUND_TOKEN`.
- `generateIssue`'s per-listing copywriting/image calls run through `Promise.all` — one listing's failure fails the whole issue generation. No half-assembled issue (3 good listings + 1 missing) is ever stored, consistent with Phase 3a's Review Focus on failing loudly instead of degrading silently.
- Defaults: `metro` = `"Seattle"`, `listingCount` = `4` (spec's defaults, both overridable per call, per the spec's "easy to tune" framing).
- Sending the assembled issue to subscribers is explicitly out of scope — deferred to whichever later phase (dashboard send button, cron job) actually triggers a send via the outbound MCP layer.

## Review Focus

- If any one listing's `writeListingBlurb` or `generatePropertyPhotos` call fails mid-batch, the whole `generateIssue` call must reject — never silently store or return an issue with some listings missing their copy or photos.
- The rendered HTML must never put price/beds/baths/sqft inside an `<img>` tag (as `alt` text or otherwise) in a way a later phase could mistake for the real data display — the numeric data component is always separate, real HTML text.
- `IssueStore.saveIssue` failing (a Supabase/network error) must propagate a clear error, not silently return a fake/empty issue id.
- `IssueStore.listIssues` with no issues saved yet must return an empty array, not throw or return `null`.
- The `{{SUBSCRIBER_EMAIL}}` placeholder must appear verbatim and intact in the rendered HTML (not HTML-entity-escaped into something a later `string.replace` can't find) so a later phase's substitution reliably works.

---

### Task 1: Supabase issue store

**Files:**
- Create: `supabase/migrations/0002_issues.sql`
- Create: `src/lib/content/issue-store.ts`
- Test: `src/lib/content/issue-store.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `StoredListing { address: string; neighborhood: string; price: number; beds: number; baths: number; sqft: number; blurb: string; photoUrls: string[] }`; `NewIssue { html: string; triggerType: "scheduled" | "manual"; marketSummary: string; listings: StoredListing[] }`; `IssueRecord extends NewIssue { id: string; createdAt: string }`; `IssueStore { saveIssue(issue: NewIssue): Promise<string>; listIssues(): Promise<IssueRecord[]>; getIssue(id: string): Promise<IssueRecord | null> }`; `IssuesTable` (same three methods, named `insert`/`selectAll`/`selectById`); `SupabaseIssueStore` (implements `IssueStore` via an injected `IssuesTable`); `createSupabaseIssuesTable(client: SupabaseClient): IssuesTable`. Tasks 2 and 3 consume `StoredListing`; Task 3 consumes `IssueStore`.

- [ ] **Step 1: Write the migration SQL**

`supabase/migrations/0002_issues.sql`:
```sql
create table issues (
  id uuid primary key default gen_random_uuid(),
  html text not null,
  trigger_type text not null check (trigger_type in ('scheduled', 'manual')),
  market_summary text not null,
  listings jsonb not null,
  created_at timestamptz not null default now()
);

alter table issues enable row level security;
```
Schema-as-code, no test — same manual-application treatment as `0001_subscribers.sql` (Dashboard SQL Editor, not automated).

- [ ] **Step 2: Write the failing tests**

```ts
// src/lib/content/issue-store.test.ts
import { describe, it, expect, vi } from "vitest";
import { SupabaseIssueStore, type IssuesTable, type IssueRecord, type NewIssue } from "./issue-store";

const sampleIssue: NewIssue = {
  html: "<html>...</html>",
  triggerType: "manual",
  marketSummary: "Seattle's market is steady.",
  listings: [
    { address: "1 Main St", neighborhood: "Fremont", price: 900_000, beds: 3, baths: 2, sqft: 1700, blurb: "Nice place.", photoUrls: ["https://img.example.com/1.png"] },
  ],
};

function makeFakeTable(): IssuesTable {
  return {
    insert: vi.fn().mockResolvedValue("issue-1"),
    selectAll: vi.fn().mockResolvedValue([]),
    selectById: vi.fn().mockResolvedValue(null),
  };
}

describe("SupabaseIssueStore", () => {
  it("saveIssue delegates to table.insert and returns its id", async () => {
    const table = makeFakeTable();
    const store = new SupabaseIssueStore(table);
    await expect(store.saveIssue(sampleIssue)).resolves.toBe("issue-1");
    expect(table.insert).toHaveBeenCalledWith(sampleIssue);
  });

  it("listIssues delegates to table.selectAll", async () => {
    const table = makeFakeTable();
    const record: IssueRecord = { ...sampleIssue, id: "issue-1", createdAt: "2026-01-01T00:00:00Z" };
    vi.mocked(table.selectAll).mockResolvedValue([record]);
    const store = new SupabaseIssueStore(table);
    await expect(store.listIssues()).resolves.toEqual([record]);
  });

  it("listIssues returns an empty array when none are saved", async () => {
    const table = makeFakeTable();
    const store = new SupabaseIssueStore(table);
    await expect(store.listIssues()).resolves.toEqual([]);
  });

  it("getIssue delegates to table.selectById", async () => {
    const table = makeFakeTable();
    const record: IssueRecord = { ...sampleIssue, id: "issue-1", createdAt: "2026-01-01T00:00:00Z" };
    vi.mocked(table.selectById).mockResolvedValue(record);
    const store = new SupabaseIssueStore(table);
    await expect(store.getIssue("issue-1")).resolves.toEqual(record);
  });

  it("getIssue returns null for an unknown id", async () => {
    const table = makeFakeTable();
    const store = new SupabaseIssueStore(table);
    await expect(store.getIssue("nope")).resolves.toBeNull();
  });
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `pnpm test src/lib/content/issue-store.test.ts`
Expected: FAIL with "Cannot find module './issue-store'"

- [ ] **Step 4: Implement `src/lib/content/issue-store.ts`**

The interfaces and `SupabaseIssueStore` from the Produces block — each method is a one-line delegation to the injected `IssuesTable`. Plus the real wiring (no test — thin, direct `@supabase/supabase-js` calls, same treatment as `createSupabaseSubscribersTable`):

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseIssuesTable(client: SupabaseClient): IssuesTable {
  return {
    async insert(issue) {
      const { data, error } = await client
        .from("issues")
        .insert({
          html: issue.html,
          trigger_type: issue.triggerType,
          market_summary: issue.marketSummary,
          listings: issue.listings,
        })
        .select("id")
        .single();
      if (error) throw new Error(`Failed to save issue: ${error.message}`);
      return data.id;
    },
    async selectAll() {
      const { data, error } = await client.from("issues").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(`Failed to list issues: ${error.message}`);
      return (data ?? []).map(rowToIssueRecord);
    },
    async selectById(id) {
      const { data, error } = await client.from("issues").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`Failed to get issue: ${error.message}`);
      return data ? rowToIssueRecord(data) : null;
    },
  };
}

function rowToIssueRecord(row: Record<string, unknown>): IssueRecord {
  return {
    id: row.id as string,
    html: row.html as string,
    triggerType: row.trigger_type as NewIssue["triggerType"],
    marketSummary: row.market_summary as string,
    listings: row.listings as StoredListing[],
    createdAt: row.created_at as string,
  };
}
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `pnpm test src/lib/content/issue-store.test.ts`
Expected: PASS (5/5)

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0002_issues.sql src/lib/content/issue-store.ts src/lib/content/issue-store.test.ts
git commit -m "feat: add Supabase-backed issue store"
```

---

### Task 2: Email HTML template

**Files:**
- Create: `src/lib/content/issue-template.ts`
- Test: `src/lib/content/issue-template.test.ts`
- Modify: `src/lib/env.ts`, `src/lib/env.test.ts`, `.env.example` (add `NEXT_PUBLIC_APP_URL`)

**Interfaces:**
- Consumes: `StoredListing` (Task 1).
- Produces: `renderIssueHtml(content: { marketCommentary: string; listings: StoredListing[]; baseUrl: string }): string`. Task 3 consumes this.

- [ ] **Step 1: Add `NEXT_PUBLIC_APP_URL` to the env schema (TDD)**

In `src/lib/env.test.ts`'s `REQUIRED` map, add `NEXT_PUBLIC_APP_URL: "http://localhost:3000"`.

Run: `pnpm test src/lib/env.test.ts` — expect FAIL on "ENV_KEYS lists exactly the required keys" (new key not yet in the schema).

In `src/lib/env.ts`, add `NEXT_PUBLIC_APP_URL: nonBlank.pipe(z.url())` to the schema (same pattern as `NEXT_PUBLIC_SUPABASE_URL`).

In `.env.example`, add:
```
# This app's own public base URL, used to build absolute links (e.g. unsubscribe) in emails
NEXT_PUBLIC_APP_URL=
```

Run: `pnpm test src/lib/env.test.ts tests/tooling/env-example.test.ts` — expect PASS (6/6, 1/1).

- [ ] **Step 2: Write the failing tests**

```ts
// src/lib/content/issue-template.test.ts
import { describe, it, expect } from "vitest";
import { renderIssueHtml } from "./issue-template";
import type { StoredListing } from "./issue-store";

const listing: StoredListing = {
  address: "123 Fremont Ave N, Fremont, Seattle, WA",
  neighborhood: "Fremont",
  price: 950_000,
  beds: 3,
  baths: 2,
  sqft: 1800,
  blurb: "A charming Fremont craftsman.",
  photoUrls: ["https://img.example.com/1.png", "https://img.example.com/2.png"],
};

describe("renderIssueHtml", () => {
  it("includes the market commentary and brand name", () => {
    const html = renderIssueHtml({ marketCommentary: "Seattle's market is steady.", listings: [listing], baseUrl: "https://realtypulse.example.com" });
    expect(html).toContain("RealtyPulse");
    expect(html).toContain("Seattle's market is steady.");
  });

  it("renders each listing's blurb, address, and photos as <img> tags", () => {
    const html = renderIssueHtml({ marketCommentary: "commentary", listings: [listing], baseUrl: "https://realtypulse.example.com" });
    expect(html).toContain(listing.blurb);
    expect(html).toContain(listing.address);
    for (const url of listing.photoUrls) {
      expect(html).toContain(`<img src="${url}"`);
    }
  });

  it("renders price, beds, baths, and sqft as plain text outside any img tag", () => {
    const html = renderIssueHtml({ marketCommentary: "commentary", listings: [listing], baseUrl: "https://realtypulse.example.com" });
    expect(html).toContain("$950,000");
    expect(html).toContain("3 bd");
    expect(html).toContain("2 ba");
    expect(html).toContain("1,800 sqft");
    // none of the numeric fields appear inside an <img ...> tag's attributes
    const imgTags = html.match(/<img[^>]*>/g) ?? [];
    for (const tag of imgTags) {
      expect(tag).not.toContain("950,000");
      expect(tag).not.toContain("1,800");
    }
  });

  it("includes an intact {{SUBSCRIBER_EMAIL}} placeholder in an absolute unsubscribe link", () => {
    const html = renderIssueHtml({ marketCommentary: "commentary", listings: [listing], baseUrl: "https://realtypulse.example.com" });
    expect(html).toContain("https://realtypulse.example.com/unsubscribe?email={{SUBSCRIBER_EMAIL}}");
  });

  it("renders multiple listings in the order given", () => {
    const second: StoredListing = { ...listing, address: "2 Other St", blurb: "Second blurb." };
    const html = renderIssueHtml({ marketCommentary: "commentary", listings: [listing, second], baseUrl: "https://realtypulse.example.com" });
    expect(html.indexOf(listing.address)).toBeLessThan(html.indexOf(second.address));
  });
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `pnpm test src/lib/content/issue-template.test.ts`
Expected: FAIL with "Cannot find module './issue-template'"

- [ ] **Step 4: Implement `src/lib/content/issue-template.ts`**

A template-literal function building one HTML document: a header (`<h1>RealtyPulse</h1>` plus a one-line tagline), a market commentary paragraph, one section per listing (a `<table>` row of `<img src="{url}" width="150" alt="Property photo" />` for each `photoUrls` entry, then a plain-text data line formatting `price` as `$${price.toLocaleString("en-US")}`, `` `${beds} bd` ``, `` `${baths} ba` ``, `` `${sqft.toLocaleString("en-US")} sqft` ``, then `address` and `blurb` as paragraphs), and a footer with a fixed placeholder physical address (e.g. `"RealtyPulse, 123 Pike St, Seattle, WA 98101"`) and an unsubscribe link: `` `<a href="${baseUrl}/unsubscribe?email={{SUBSCRIBER_EMAIL}}">Unsubscribe</a>` ``. Table-based layout, inline styles — exact visual styling is this step's own call, not pinned further here.

- [ ] **Step 5: Run tests, verify they pass**

Run: `pnpm test src/lib/content/issue-template.test.ts`
Expected: PASS (5/5)

- [ ] **Step 6: Commit**

```bash
git add src/lib/content/issue-template.ts src/lib/content/issue-template.test.ts src/lib/env.ts src/lib/env.test.ts .env.example
git commit -m "feat: add branded HTML email template for issues"
```

---

### Task 3: Issue generation pipeline

**Files:**
- Create: `src/lib/content/generate-issue.ts`
- Test: `src/lib/content/generate-issue.test.ts`

**Interfaces:**
- Consumes: `generateListings` (`listing-generator.ts`), `MarketResearcher` (`market-researcher.ts`), `Copywriter` (`copywriter.ts`), `ImageGenerator` (`image-generator.ts`), `IssueStore` (Task 1), `renderIssueHtml` (Task 2).
- Produces: `GenerateIssueDeps { researcher: MarketResearcher; copywriter: Copywriter; imageGenerator: ImageGenerator; issueStore: IssueStore; baseUrl: string }`; `GenerateIssueOptions { triggerType: "scheduled" | "manual"; metro?: string; listingCount?: number }`; `generateIssue(deps: GenerateIssueDeps, options: GenerateIssueOptions): Promise<{ issueId: string; html: string }>`. Later phases (dashboard, cron) consume `generateIssue`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/content/generate-issue.test.ts
import { describe, it, expect, vi } from "vitest";
import { generateIssue, type GenerateIssueDeps } from "./generate-issue";
import type { MarketResearcher } from "./market-researcher";
import type { Copywriter } from "./copywriter";
import type { ImageGenerator } from "./image-generator";
import type { IssueStore } from "./issue-store";

function makeDeps(overrides: Partial<GenerateIssueDeps> = {}): GenerateIssueDeps {
  const researcher: MarketResearcher = { research: vi.fn().mockResolvedValue({ summary: "steady market", citations: [] }) };
  const copywriter: Copywriter = {
    writeMarketCommentary: vi.fn().mockResolvedValue("Seattle's market is steady."),
    writeListingBlurb: vi.fn().mockResolvedValue("A lovely home."),
  };
  const imageGenerator: ImageGenerator = { generatePropertyPhotos: vi.fn().mockResolvedValue(["https://img.example.com/1.png"]) };
  const issueStore: IssueStore = {
    saveIssue: vi.fn().mockResolvedValue("issue-1"),
    listIssues: vi.fn().mockResolvedValue([]),
    getIssue: vi.fn().mockResolvedValue(null),
  };
  return { researcher, copywriter, imageGenerator, issueStore, baseUrl: "https://realtypulse.example.com", ...overrides };
}

describe("generateIssue", () => {
  it("calls research, commentary, and per-listing copy/photos for the default listing count, then saves and returns the issue", async () => {
    const deps = makeDeps();
    const result = await generateIssue(deps, { triggerType: "manual" });

    expect(deps.researcher.research).toHaveBeenCalledWith("Seattle");
    expect(deps.copywriter.writeMarketCommentary).toHaveBeenCalledTimes(1);
    expect(deps.copywriter.writeListingBlurb).toHaveBeenCalledTimes(4);
    expect(deps.imageGenerator.generatePropertyPhotos).toHaveBeenCalledTimes(4);
    expect(deps.issueStore.saveIssue).toHaveBeenCalledTimes(1);
    const savedIssue = vi.mocked(deps.issueStore.saveIssue).mock.calls[0][0];
    expect(savedIssue.listings).toHaveLength(4);
    expect(savedIssue.triggerType).toBe("manual");
    expect(savedIssue.marketSummary).toBe("steady market");
    expect(result).toEqual({ issueId: "issue-1", html: savedIssue.html });
  });

  it("respects a custom metro and listingCount", async () => {
    const deps = makeDeps();
    await generateIssue(deps, { triggerType: "scheduled", metro: "Portland", listingCount: 2 });
    expect(deps.researcher.research).toHaveBeenCalledWith("Portland");
    expect(deps.copywriter.writeListingBlurb).toHaveBeenCalledTimes(2);
  });

  it("rejects the whole call when one listing's blurb generation fails, without saving anything", async () => {
    const deps = makeDeps();
    vi.mocked(deps.copywriter.writeListingBlurb)
      .mockResolvedValueOnce("ok")
      .mockRejectedValueOnce(new Error("Anthropic API unavailable"));
    await expect(generateIssue(deps, { triggerType: "manual" })).rejects.toThrow("Anthropic API unavailable");
    expect(deps.issueStore.saveIssue).not.toHaveBeenCalled();
  });

  it("rejects the whole call when one listing's photo generation fails, without saving anything", async () => {
    const deps = makeDeps();
    vi.mocked(deps.imageGenerator.generatePropertyPhotos)
      .mockResolvedValueOnce(["https://img.example.com/1.png"])
      .mockRejectedValueOnce(new Error("kie.ai task timed out"));
    await expect(generateIssue(deps, { triggerType: "manual" })).rejects.toThrow("kie.ai task timed out");
    expect(deps.issueStore.saveIssue).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm test src/lib/content/generate-issue.test.ts`
Expected: FAIL with "Cannot find module './generate-issue'"

- [ ] **Step 3: Implement `src/lib/content/generate-issue.ts`**

`generateIssue(deps, options)`:
1. `metro = options.metro ?? "Seattle"`, `listingCount = options.listingCount ?? 4`.
2. `listings = generateListings(listingCount)`.
3. `research = await deps.researcher.research(metro)`.
4. `marketCommentary = await deps.copywriter.writeMarketCommentary(research, metro)`.
5. `listingContents = await Promise.all(listings.map(async (listing) => ({ ...listing, blurb: await deps.copywriter.writeListingBlurb(listing), photoUrls: await deps.imageGenerator.generatePropertyPhotos(listing) })))` — the signature and test fully determine this; no further algorithm to describe.
6. `html = renderIssueHtml({ marketCommentary, listings: listingContents, baseUrl: deps.baseUrl })`.
7. `issueId = await deps.issueStore.saveIssue({ html, triggerType: options.triggerType, marketSummary: research.summary, listings: listingContents })`.
8. Return `{ issueId, html }`.

- [ ] **Step 4: Run tests, verify they pass**

Run: `pnpm test src/lib/content/generate-issue.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: Run the whole suite and `pnpm check`**

Run: `pnpm check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/content/generate-issue.ts src/lib/content/generate-issue.test.ts
git commit -m "feat: add issue generation pipeline"
```

---

## Manual Verification (user-run, after this plan lands)

1. Apply `supabase/migrations/0002_issues.sql` via the Supabase Dashboard SQL Editor for project `qrfaaegrnzkysimiafwa`.
2. Set `NEXT_PUBLIC_APP_URL` in `.env` (e.g. `http://localhost:3000` for local dev).
3. Once real `ANTHROPIC_API_KEY`/`PERPLEXITY_API_KEY`/`KIE_AI_API_KEY` and the Supabase values are all in `.env` (per Phase 3a and Phase 2's own Manual Verification steps), run a one-off script calling `generateIssue` with the real factories (`createPerplexityResearcher`, `createClaudeCopywriter`+`createAnthropicMessageClient`, `createKieAiImageGenerator`, `createSupabaseIssuesTable`+`SupabaseIssueStore`) and open the returned `html` in a browser to eyeball it — this is also where kie.ai's real `resultJson`/`resultUrls` shape (Phase 3a's one unconfirmed guess) gets its first real-world exercise through the full pipeline.

## Self-Review

**Spec coverage:** Covers the spec's remaining pipeline steps 5 ("Assemble the branded HTML email") and 6 ("Store the assembled issue... for the dashboard archive"), completing Phase 3's content pipeline alongside plan 3a. Step 7 ("Send") is explicitly out of scope, deferred to whichever later phase triggers a send.

**Step scan:** Every step pins an exact file, signature, or test; the one "no test" call-out (`createSupabaseIssuesTable`) is thin direct Supabase wiring, consistent with Phase 1/2/3a's treatment of equivalent factories. Task 3 Step 3's one unwritten line (`listingContents = ...`) is fully determined by the signature and the test's call-count assertions — nothing left undecided.

**Type consistency:** `StoredListing` (Task 1) is used identically in Task 2's test fixture and Task 3's `generateIssue` output. `IssueStore` (Task 1) and `renderIssueHtml` (Task 2) are consumed by Task 3 with the exact names and shapes their own Interfaces blocks declare.

**Review Focus:** all five lines have an owning task and an automated test (Promise.all failure propagation ×2, numeric-data-outside-img-tags, empty listIssues, intact placeholder token).

**Proportion:** three small tasks; the one substantial code block (the HTML template's structure) is described by its pieces and left to the implementer for exact markup/styling — nothing here is a line that decides nothing, and nothing is a transcript of code the tests already determine.
