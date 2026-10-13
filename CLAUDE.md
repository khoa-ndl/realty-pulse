# RealtyPulse — Project Conventions

Portfolio project: an AI-driven weekly newsletter pipeline for a fictional
real-estate brokerage. Full design: [docs/superpowers/specs/2026-10-12-realty-pulse-newsletter-design.md](docs/superpowers/specs/2026-10-12-realty-pulse-newsletter-design.md).

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

## Current phase

Scaffold complete (Next.js + pnpm + Vitest + env validation). Next:
the outbound MCP layer (`send_email`, `add_subscriber`, `list_subscribers`,
`remove_subscriber` tools; default Gmail + Supabase implementation).
