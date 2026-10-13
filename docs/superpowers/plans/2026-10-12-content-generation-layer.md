# Content Generation Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four data/AI-generation building blocks Phase 3 needs — a synthetic listing generator, a Perplexity-backed market researcher, a Claude-backed copywriter, and a kie.ai (Nano Banana) property-photo generator — each behind its own interface and fully unit-tested against fakes, so the next plan (assembly + storage) can compose them without touching any external API directly.

**Architecture:** The listing generator is a pure function (no I/O). The three AI clients each follow the same shape: an interface the rest of the app depends on, a real implementation that takes an injected HTTP primitive (`fetch`-like, or a minimal SDK-wrapping interface for Claude) so its request-building and response-parsing logic is testable without a network call, and a thin factory that wires the real API key/SDK client. This mirrors Phase 2's `EmailSender`/`GmailClient` split.

**Tech Stack:** `@anthropic-ai/sdk` (official Claude API SDK) for copywriting; plain `fetch` for Perplexity and kie.ai (neither has an official first-party Node SDK, and both are simple enough that adding an unofficial wrapper package isn't warranted).

**Spec:** [docs/superpowers/specs/2026-10-12-realty-pulse-newsletter-design.md](../specs/2026-10-12-realty-pulse-newsletter-design.md)

## Global Constraints

- 4 listings per issue (spec's default, tunable) — this plan's generator takes `count` as a parameter rather than hardcoding 4, so the caller (next plan) decides.
- Target metro is Seattle (spec's choice) — the listing generator's neighborhood/street data and the researcher's prompt are Seattle-specific; swapping metros later means changing this plan's data/prompts, not its interfaces.
- Perplexity model: `sonar` (current Sonar-family chat-completions model; `sonar-pro` is **not** used — `sonar` is sufficient for a market-summary query and cheaper).
- kie.ai's exact `recordInfo` response field names (where the final image URL(s) live — `data.resultJson` vs `data.response.resultUrls`) are **not confirmed from documentation** — the docs available described the async create-then-poll pattern and the `createTask` response shape clearly, but not the success-result body. Task 4's parser is this plan's best-effort read from available third-party sources; it gets verified for real during this phase's Manual Verification step once a real `KIE_AI_API_KEY` is available, and corrected then if wrong.
- None of these three AI services are behind the spec's swappable MCP layer — they're fixed, internal implementation details of the product (per spec's Non-Goals), same as Claude itself.
- Numeric listing data (price, beds, baths, sqft) is generated here as structured data, never baked into a generated image (spec anti-goal) — Task 1 produces it as plain numbers; later phases render it as real HTML/CSS.

## Review Focus

- A Perplexity API call fails (network error, non-2xx, malformed response) — the researcher must throw a clear error, not return empty/garbage research that silently flows into the newsletter as if it were real market data.
- A Claude API call fails — same: a clear thrown error, not silently-empty copy shipped to subscribers.
- A kie.ai generation task reaches `state: "fail"` — the image generator must throw a clear error, not return an empty or broken URL array that a later phase renders as a dead image.
- A kie.ai generation task never leaves `state: "waiting"` — polling must give up after a bounded number of attempts, not hang the whole pipeline indefinitely.
- The listing generator must never produce a price, beds, baths, or sqft value outside its documented plausible range — undermines the product's credibility if a generated listing looks absurd (e.g. a 1-bed condo at 9,000 sqft).

---

### Task 1: Synthetic listing generator

**Files:**
- Create: `src/lib/content/listing-generator.ts`
- Test: `src/lib/content/listing-generator.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `SyntheticListing { address: string; neighborhood: string; price: number; beds: number; baths: number; sqft: number; blurbSeed: string }`; `generateListings(count: number, rng?: () => number): SyntheticListing[]`. Tasks 3 (copywriter) and later plans consume `SyntheticListing`.

Plausible ranges for the Seattle metro (this plan's call): price `$650,000`–`$2,100,000`; beds `1`–`5`; baths `1`–`4`; sqft `600`–`4200`. Neighborhoods (fixed list): `Ballard`, `Fremont`, `Capitol Hill`, `Queen Anne`, `Green Lake`, `Wallingford`, `West Seattle`, `Beacon Hill`, `Columbia City`, `Magnolia`. Street names (fixed list, any 6 realistic Seattle-style names, e.g. `NW 85th St`, `Fremont Ave N`, `15th Ave E`, `California Ave SW`, `Rainier Ave S`, `Greenwood Ave N`). `blurbSeed` is a short internal descriptor like `"3BR craftsman near Green Lake"` — fed to the copywriter as a seed, never shown to a reader directly.

`rng` defaults to `Math.random`; a test injects a fake returning fixed values in `[0, 1)` to pin exact boundary behavior.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/content/listing-generator.test.ts
import { describe, it, expect } from "vitest";
import { generateListings } from "./listing-generator";

describe("generateListings", () => {
  it("generates exactly `count` listings", () => {
    expect(generateListings(4, () => 0.5)).toHaveLength(4);
  });

  it("keeps every field within its documented range at the rng=0 boundary", () => {
    const [listing] = generateListings(1, () => 0);
    expect(listing.price).toBeGreaterThanOrEqual(650_000);
    expect(listing.beds).toBeGreaterThanOrEqual(1);
    expect(listing.baths).toBeGreaterThanOrEqual(1);
    expect(listing.sqft).toBeGreaterThanOrEqual(600);
  });

  it("keeps every field within its documented range at the rng=0.999 boundary", () => {
    const [listing] = generateListings(1, () => 0.999);
    expect(listing.price).toBeLessThanOrEqual(2_100_000);
    expect(listing.beds).toBeLessThanOrEqual(5);
    expect(listing.baths).toBeLessThanOrEqual(4);
    expect(listing.sqft).toBeLessThanOrEqual(4200);
  });

  it("includes a neighborhood from the fixed list and a non-empty blurbSeed", () => {
    const [listing] = generateListings(1, () => 0.3);
    expect([
      "Ballard", "Fremont", "Capitol Hill", "Queen Anne", "Green Lake",
      "Wallingford", "West Seattle", "Beacon Hill", "Columbia City", "Magnolia",
    ]).toContain(listing.neighborhood);
    expect(listing.blurbSeed.length).toBeGreaterThan(0);
    expect(listing.address).toContain(listing.neighborhood);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm test src/lib/content/listing-generator.test.ts`
Expected: FAIL with "Cannot find module './listing-generator'"

- [ ] **Step 3: Implement `src/lib/content/listing-generator.ts`**

Define the fixed `NEIGHBORHOODS` and `STREET_NAMES` arrays from the Interfaces block above. `generateListings(count, rng = Math.random)` loops `count` times, each iteration picking one neighborhood and one street name via `rng()`-scaled array indexing, a street number via `rng()`-scaled `100`–`9999`, and scaling `rng()` linearly into each field's documented range (`min + rng() * (max - min)`, rounded to an integer for beds/baths/sqft/price). `address` is `${streetNumber} ${streetName}, ${neighborhood}, Seattle, WA`. `blurbSeed` is a short template string built from `beds`, a fixed home-type word (e.g. `"craftsman"`, `"townhome"`, `"bungalow"` — pick via `rng()`), and the neighborhood, e.g. `` `${beds}BR ${homeType} near ${neighborhood}` ``.

- [ ] **Step 4: Run tests, verify they pass**

Run: `pnpm test src/lib/content/listing-generator.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/listing-generator.ts src/lib/content/listing-generator.test.ts
git commit -m "feat: add synthetic listing generator for the Seattle metro"
```

---

### Task 2: Perplexity market researcher

**Files:**
- Create: `src/lib/content/market-researcher.ts`
- Test: `src/lib/content/market-researcher.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `MarketResearch { summary: string; citations: string[] }`; `MarketResearcher { research(metro: string): Promise<MarketResearch> }`; `createPerplexityResearcher(apiKey: string, fetchImpl?: typeof fetch): MarketResearcher`. The next plan (assembly) consumes `MarketResearcher` and `MarketResearch`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/content/market-researcher.test.ts
import { describe, it, expect, vi } from "vitest";
import { createPerplexityResearcher } from "./market-researcher";

function fakeFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

describe("createPerplexityResearcher", () => {
  it("posts a sonar chat-completions request naming the metro", async () => {
    const fetchImpl = fakeFetch({
      choices: [{ message: { content: "Seattle's market is cooling slightly." } }],
      citations: ["https://example.com/seattle-market"],
    });
    const researcher = createPerplexityResearcher("test-key", fetchImpl);
    await researcher.research("Seattle");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.perplexity.ai/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("sonar");
    expect(body.messages[0].content).toContain("Seattle");
  });

  it("returns the summary and citations from a successful response", async () => {
    const fetchImpl = fakeFetch({
      choices: [{ message: { content: "Seattle's market is cooling slightly." } }],
      citations: ["https://example.com/seattle-market"],
    });
    const researcher = createPerplexityResearcher("test-key", fetchImpl);
    const result = await researcher.research("Seattle");
    expect(result).toEqual({
      summary: "Seattle's market is cooling slightly.",
      citations: ["https://example.com/seattle-market"],
    });
  });

  it("throws a clear error on a non-2xx response", async () => {
    const fetchImpl = fakeFetch({ error: "rate limited" }, 429);
    const researcher = createPerplexityResearcher("test-key", fetchImpl);
    await expect(researcher.research("Seattle")).rejects.toThrow(/429|Perplexity/);
  });

  it("throws a clear error when the response has no choices", async () => {
    const fetchImpl = fakeFetch({ choices: [] });
    const researcher = createPerplexityResearcher("test-key", fetchImpl);
    await expect(researcher.research("Seattle")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm test src/lib/content/market-researcher.test.ts`
Expected: FAIL with "Cannot find module './market-researcher'"

- [ ] **Step 3: Implement `src/lib/content/market-researcher.ts`**

`createPerplexityResearcher(apiKey, fetchImpl = fetch)` returns an object whose `research(metro)`:
1. POSTs to `https://api.perplexity.ai/chat/completions` with headers `{ Authorization: \`Bearer ${apiKey}\`, "Content-Type": "application/json" }` and body `{ model: "sonar", messages: [{ role: "user", content: <prompt> }] }`, where `<prompt>` asks for a short (2-3 sentence) current real-estate market summary for `metro`.
2. If the response status is not 2xx, throws `Error` naming the status (e.g. `` `Perplexity API error: ${response.status}` ``).
3. Parses the JSON body; if `choices[0]?.message?.content` is missing, throws a clear `Error`.
4. Returns `{ summary: choices[0].message.content, citations: body.citations ?? [] }`.

- [ ] **Step 4: Run tests, verify they pass**

Run: `pnpm test src/lib/content/market-researcher.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/market-researcher.ts src/lib/content/market-researcher.test.ts
git commit -m "feat: add Perplexity-backed market researcher"
```

---

### Task 3: Claude copywriter

**Files:**
- Create: `src/lib/content/copywriter.ts`
- Test: `src/lib/content/copywriter.test.ts`

**Interfaces:**
- Consumes: `SyntheticListing` (Task 1), `MarketResearch` (Task 2).
- Produces: `Copywriter { writeMarketCommentary(research: MarketResearch, metro: string): Promise<string>; writeListingBlurb(listing: SyntheticListing): Promise<string> }`; `AnthropicMessageClient { createMessage(prompt: string): Promise<string> }` (minimal injected seam, mirrors Task 2's `EmailSender`/`GmailClient` split); `createClaudeCopywriter(client: AnthropicMessageClient): Copywriter`; `createAnthropicMessageClient(apiKey: string): AnthropicMessageClient` (real wiring via `@anthropic-ai/sdk`, no test — thin, same treatment as Phase 2's `createGmailClient`).

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/content/copywriter.test.ts
import { describe, it, expect, vi } from "vitest";
import { createClaudeCopywriter, type AnthropicMessageClient } from "./copywriter";
import type { SyntheticListing } from "./listing-generator";

const listing: SyntheticListing = {
  address: "123 Fremont Ave N, Fremont, Seattle, WA",
  neighborhood: "Fremont",
  price: 950_000,
  beds: 3,
  baths: 2,
  sqft: 1800,
  blurbSeed: "3BR craftsman near Fremont",
};

describe("createClaudeCopywriter", () => {
  it("writeMarketCommentary sends the research summary and metro to the client", async () => {
    const client: AnthropicMessageClient = { createMessage: vi.fn().mockResolvedValue("Seattle's market is steady.") };
    const copywriter = createClaudeCopywriter(client);
    const result = await copywriter.writeMarketCommentary(
      { summary: "cooling slightly", citations: [] },
      "Seattle"
    );
    expect(result).toBe("Seattle's market is steady.");
    const prompt = vi.mocked(client.createMessage).mock.calls[0][0];
    expect(prompt).toContain("cooling slightly");
    expect(prompt).toContain("Seattle");
  });

  it("writeListingBlurb sends the listing's blurbSeed and data to the client", async () => {
    const client: AnthropicMessageClient = { createMessage: vi.fn().mockResolvedValue("A charming Fremont craftsman.") };
    const copywriter = createClaudeCopywriter(client);
    const result = await copywriter.writeListingBlurb(listing);
    expect(result).toBe("A charming Fremont craftsman.");
    const prompt = vi.mocked(client.createMessage).mock.calls[0][0];
    expect(prompt).toContain(listing.blurbSeed);
    expect(prompt).toContain(String(listing.price));
  });

  it("propagates a client error instead of swallowing it", async () => {
    const client: AnthropicMessageClient = { createMessage: vi.fn().mockRejectedValue(new Error("Anthropic API unavailable")) };
    const copywriter = createClaudeCopywriter(client);
    await expect(copywriter.writeListingBlurb(listing)).rejects.toThrow("Anthropic API unavailable");
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm test src/lib/content/copywriter.test.ts`
Expected: FAIL with "Cannot find module './copywriter'"

- [ ] **Step 3: Install `@anthropic-ai/sdk`**

Run: `pnpm add @anthropic-ai/sdk`

- [ ] **Step 4: Implement `src/lib/content/copywriter.ts`**

`createClaudeCopywriter(client)` returns `writeMarketCommentary(research, metro)` which calls `client.createMessage(prompt)` with a prompt asking for a short (2-3 sentence), warm, professional newsletter commentary section, including `research.summary` and `metro` in the prompt text, and returns the client's result unchanged (errors propagate — no try/catch here, matching this task's own test). `writeListingBlurb(listing)` similarly builds a prompt asking for a 2-3 sentence real-estate listing blurb from `listing.blurbSeed`, `listing.price`, `listing.beds`, `listing.baths`, `listing.sqft`, and returns the client's result.

The real wiring (no test — thin, direct `@anthropic-ai/sdk` call):

```ts
import Anthropic from "@anthropic-ai/sdk";

export function createAnthropicMessageClient(apiKey: string): AnthropicMessageClient {
  const anthropic = new Anthropic({ apiKey });
  return {
    async createMessage(prompt: string) {
      const message = await anthropic.messages.create({
        model: "claude-haiku-5-5", // see plan's ledger ruling: Haiku fits this cheap, high-volume copywriting task
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      });
      const block = message.content.find((b) => b.type === "text");
      if (!block) throw new Error("Anthropic response had no text content");
      return block.text;
    },
  };
}
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `pnpm test src/lib/content/copywriter.test.ts`
Expected: PASS (3/3)

- [ ] **Step 6: Commit**

```bash
git add src/lib/content/copywriter.ts src/lib/content/copywriter.test.ts package.json pnpm-lock.yaml
git commit -m "feat: add Claude-backed copywriter"
```

---

### Task 4: kie.ai (Nano Banana) property photo generator

**Files:**
- Create: `src/lib/content/image-generator.ts`
- Test: `src/lib/content/image-generator.test.ts`

**Interfaces:**
- Consumes: `SyntheticListing` (Task 1).
- Produces: `ImageGenerator { generatePropertyPhotos(listing: SyntheticListing): Promise<string[]> }`; `createKieAiImageGenerator(apiKey: string, options?: { fetchImpl?: typeof fetch; sleepImpl?: (ms: number) => Promise<void>; maxPolls?: number }): ImageGenerator`. The next plan (assembly) consumes `ImageGenerator`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/content/image-generator.test.ts
import { describe, it, expect, vi } from "vitest";
import { createKieAiImageGenerator } from "./image-generator";
import type { SyntheticListing } from "./listing-generator";

const listing: SyntheticListing = {
  address: "123 Fremont Ave N, Fremont, Seattle, WA",
  neighborhood: "Fremont",
  price: 950_000,
  beds: 3,
  baths: 2,
  sqft: 1800,
  blurbSeed: "3BR craftsman near Fremont",
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("createKieAiImageGenerator", () => {
  it("creates a task naming the model and a prompt built from the listing, then polls until success", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { taskId: "task-1" } }))
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { state: "waiting" } }))
      .mockResolvedValueOnce(
        jsonResponse({ code: 200, data: { state: "success", resultJson: JSON.stringify({ resultUrls: ["https://img.example.com/1.png"] }) } })
      );
    const sleepImpl = vi.fn().mockResolvedValue(undefined);
    const generator = createKieAiImageGenerator("test-key", { fetchImpl, sleepImpl });

    const urls = await generator.generatePropertyPhotos(listing);

    expect(urls).toEqual(["https://img.example.com/1.png"]);
    const [createUrl, createInit] = fetchImpl.mock.calls[0];
    expect(createUrl).toBe("https://api.kie.ai/api/v1/jobs/createTask");
    expect(createInit.headers.Authorization).toBe("Bearer test-key");
    const createBody = JSON.parse(createInit.body);
    expect(createBody.model).toBe("google/nano-banana");
    expect(createBody.input.prompt).toContain(listing.neighborhood);
    expect(fetchImpl.mock.calls[1][0]).toContain("task-1");
    expect(sleepImpl).toHaveBeenCalledTimes(1);
  });

  it("throws a clear error when the task reaches state fail", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { taskId: "task-2" } }))
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { state: "fail", failMsg: "content policy" } }));
    const generator = createKieAiImageGenerator("test-key", { fetchImpl, sleepImpl: vi.fn() });
    await expect(generator.generatePropertyPhotos(listing)).rejects.toThrow(/content policy|fail/);
  });

  it("gives up after maxPolls attempts stuck in waiting", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { taskId: "task-3" } }))
      .mockResolvedValue(jsonResponse({ code: 200, data: { state: "waiting" } }));
    const generator = createKieAiImageGenerator("test-key", { fetchImpl, sleepImpl: vi.fn(), maxPolls: 3 });
    await expect(generator.generatePropertyPhotos(listing)).rejects.toThrow(/timed out|maxPolls|waiting/i);
    expect(fetchImpl).toHaveBeenCalledTimes(1 + 3);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm test src/lib/content/image-generator.test.ts`
Expected: FAIL with "Cannot find module './image-generator'"

- [ ] **Step 3: Implement `src/lib/content/image-generator.ts`**

`createKieAiImageGenerator(apiKey, { fetchImpl = fetch, sleepImpl = (ms) => new Promise((r) => setTimeout(r, ms)), maxPolls = 30 } = {})` returns `generatePropertyPhotos(listing)`:
1. POSTs to `https://api.kie.ai/api/v1/jobs/createTask` with headers `{ Authorization: \`Bearer ${apiKey}\`, "Content-Type": "application/json" }` and body `{ model: "google/nano-banana", input: { prompt: <prompt>, output_format: "png" } }`, where `<prompt>` is a short real-estate photo prompt built from `listing.beds`, `listing.baths`, `listing.sqft`, and `listing.neighborhood`. Extracts `taskId` from `body.data.taskId`.
2. Loops up to `maxPolls` times: GET `` `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}` `` with the same Authorization header.
   - `state === "success"`: parse `data.resultJson` as JSON and return its `resultUrls` array — **this field path is the plan's unconfirmed guess (see Global Constraints); verify against the real API during Manual Verification and correct here if wrong.**
   - `state === "fail"`: throw `Error` including `data.failMsg` if present, else a generic fail message.
   - otherwise (`"waiting"` or any in-progress state): `await sleepImpl(2000)` and continue the loop.
3. If the loop exits without success or fail, throw an `Error` naming `maxPolls` (e.g. `` `kie.ai task timed out after ${maxPolls} polls` ``).

- [ ] **Step 4: Run tests, verify they pass**

Run: `pnpm test src/lib/content/image-generator.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: Run the whole suite and `pnpm check`**

Run: `pnpm check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/content/image-generator.ts src/lib/content/image-generator.test.ts
git commit -m "feat: add kie.ai (Nano Banana) property photo generator"
```

---

## Manual Verification (user-run, after this plan lands)

1. Confirm real `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`, and `KIE_AI_API_KEY` values are in `.env` (filled in by the user — Claude can't read or write the real file).
2. Run a one-off script calling each of `createPerplexityResearcher`, `createAnthropicMessageClient` + `createClaudeCopywriter`, and `createKieAiImageGenerator` with real keys against real listings from `generateListings(1)`, and inspect the output by hand — especially `image-generator.ts`'s `resultJson`/`resultUrls` parsing, which is this plan's one unconfirmed guess about the real kie.ai response shape.
3. If the real kie.ai response shape differs from the guess, fix the parsing in `image-generator.ts` and add a regression test matching the real shape, then re-run `pnpm check`.

## Self-Review

**Spec coverage:** Covers the spec's "Generate synthetic listings," "Perplexity: research," and "Nano Banana via kie.ai: generate a photo carousel" pipeline steps, plus the copywriting half of "Claude: write market commentary + per-listing copy." Assembling these into an actual issue (the remaining pipeline step) and storing it is deferred to the next plan, per the agreed two-plan split for this phase.

**Step scan:** Every step pins an exact signature, file, or test; the one "no test" call-out (`createAnthropicMessageClient`) is thin direct SDK wiring, consistent with Phase 1/2's treatment of `createGmailClient`/`createSupabaseSubscribersTable`.

**Type consistency:** `SyntheticListing` (Task 1) is consumed identically by Task 3 and Task 4's test fixtures. `MarketResearch` (Task 2) is consumed identically by Task 3. `AnthropicMessageClient`'s single method name (`createMessage`) is used the same way in Task 3's test and implementation.

**Review Focus:** all five lines have an owning task and an automated test (Perplexity non-2xx/empty-choices, Claude error propagation, kie.ai fail-state and maxPolls-timeout, listing generator's range-boundary tests).

**Proportion:** four small tasks; code blocks appear only where an algorithm isn't fully determined by signature and test (range-scaling arithmetic, the poll loop, the real SDK/fetch wiring) — tool-call shapes elsewhere are described by name and left to the implementer.

## Post-Execution Note

The final review flagged that `generatePropertyPhotos(listing): Promise<string[]>` returns whatever single-task result kie.ai gives back for one prompt — it does not itself guarantee a multi-shot "carousel" (exterior, kitchen, living room, etc.) of one consistent property. Ruling: deciding how to get a coherent multi-photo carousel per listing (multiple calls with different room prompts? image-to-image chaining for consistency?) is an assembly-layer/orchestration decision, not this building-block's — the next plan (assembly + storage) owns that call. See the plan's ledger for the full ruling text.
