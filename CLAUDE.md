# RealtyPulse — Project Conventions

An AI-driven weekly newsletter platform for real-estate brokerages. Full design: [docs/superpowers/specs/2026-10-12-realty-pulse-newsletter-design.md](docs/superpowers/specs/2026-10-12-realty-pulse-newsletter-design.md).

## Commands

- `pnpm check` — the one command that runs every check (lint, typecheck,
  test, build). Run it before every commit; it must pass.
- `pnpm test` — Vitest only.
- `pnpm dev` — local dev server.

## Conventions

- Package manager is **pnpm**, not npm or yarn.
- New required environment variables are declared in `src/lib/env.ts`
  (the Zod schema) and in `.env.example` — never read via raw
  `process.env` elsewhere in the app. A test (`tests/tooling/env-example.test.ts`)
  fails if the two drift apart.
- Node version is pinned in `.nvmrc`; keep `package.json`'s
  `engines.node` in sync with it.
- External API clients (Gmail, Supabase, Perplexity, Anthropic, kie.ai)
  are each wrapped behind an interface with an injectable seam (`fetch`,
  or a minimal client wrapper), so request-building and response-parsing
  logic is unit-tested against fakes. The real wiring factory itself
  (e.g. `createGmailClient`, `createSupabaseSubscribersTable`) is thin
  and untested by design — that's exercised by the Manual Verification
  steps in each phase's plan doc instead.

## Current phase

Scaffold, the outbound MCP layer (Gmail + Supabase), the full content
pipeline, the operator dashboard (generate & send, issue archive,
subscriber management, scheduled-run status), the public signup/confirm/
unsubscribe flow, and a brand-matched visual pass (dashboard UI +
newsletter/confirmation email templates, against
`design-system/realtypulse/MASTER.md`) are all complete. Not yet done:
first deploy to Vercel, and filling in the local `.env` (several
Supabase/MCP/cron values are still blank, which blocks running `/login`
and `/dashboard` locally — `/subscribe` and the other public pages don't
need them).
