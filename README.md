# RealtyPulse

RealtyPulse is an AI-driven weekly newsletter platform for residential real-estate brokerages. Each issue is researched, written, illustrated, and sent automatically: current market commentary grounded in real research, a handful of spotlight listings with photos and data, and no manual authoring required.

Full product design — intent, goals, architecture, and what's intentionally out of scope — lives in [the design doc](docs/superpowers/specs/2026-10-12-realty-pulse-newsletter-design.md).

## How it works

1. **Listings** are generated from a synthetic dataset shaped like a real MLS/RESO feed, so swapping in a licensed listing data provider later doesn't touch the rest of the pipeline.
2. **Market research** comes from the Perplexity API, grounding each issue's commentary in real, current information.
3. **Copywriting** — market commentary and per-listing blurbs — is written by Claude from that research and listing data.
4. **Property photos** are generated per listing via kie.ai (Nano Banana). Price, beds, baths, and square footage are always rendered as real HTML, never baked into an image.
5. **Issues** are assembled into branded HTML and stored for the dashboard archive.
6. **Sending** goes through a dedicated MCP server exposing `send_email`/`add_subscriber`/`list_subscribers`/`remove_subscriber` — swapping a brokerage's existing email provider or CRM is a matter of pointing at a different MCP server, not rewriting the app.

## Status

Built so far: project scaffold, the outbound MCP layer (Gmail + Supabase), and the full content pipeline (listing generation, research, copywriting, image generation, issue assembly, and storage).

Up next: the operator dashboard (generate & send, issue archive, subscriber management, scheduled-run status).

## Prerequisites

- Node (see [.nvmrc](.nvmrc) for the exact version)
- [pnpm](https://pnpm.io)
- Supabase project and Gmail OAuth credentials — see [Setup](#setup)

## Setup

```bash
pnpm install
cp .env.example .env
# then fill in the real values in .env yourself
```

`.env.example` documents every required variable. Gmail OAuth credentials require a one-time manual setup — see [docs/gmail-oauth-setup.md](docs/gmail-oauth-setup.md).

## Development

```bash
pnpm dev     # start the dev server
pnpm check   # lint + typecheck + test + build — run this before every commit
```

## License

MIT — see [LICENSE](LICENSE).
