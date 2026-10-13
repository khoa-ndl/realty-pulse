# RealtyPulse

A portfolio project demonstrating a full AI content pipeline: a fictional
residential real-estate brokerage sends its buyer/seller clients a weekly
newsletter that is researched, written, illustrated, and sent with no
manual authoring. See the full design doc for intent, goals, and
architecture: [docs/superpowers/specs/2026-10-12-realty-pulse-newsletter-design.md](docs/superpowers/specs/2026-10-12-realty-pulse-newsletter-design.md).

## Status

Scaffold only — no product features yet. Next up: the outbound MCP layer
(email sending, subscriber management).

## Prerequisites

- Node (see [.nvmrc](.nvmrc) for the exact version)
- [pnpm](https://pnpm.io)

## Setup

```bash
pnpm install
cp .env.example .env
# then fill in the real values in .env yourself
```

## Development

```bash
pnpm dev     # start the dev server
pnpm check   # lint + typecheck + test + build — run this before every commit
```
