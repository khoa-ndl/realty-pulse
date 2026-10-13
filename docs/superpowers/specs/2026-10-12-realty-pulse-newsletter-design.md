# RealtyPulse — Branded Newsletter Automation (Design)

## Intent

RealtyPulse ("RealtyPulse" — working name)
is a residential real-estate brokerage's weekly newsletter, fully
automated end to end: researched, written, illustrated, and sent with no
manual authoring. Synthetic listing data stands in for a brokerage's real
MLS feed until a licensed feed is connected; real market research gives
the content substance; copy and property imagery are AI-generated; and an
operator dashboard lets brokerage staff trigger, preview, and monitor
sends themselves.

A core design goal: the outbound integration layer (email sending,
subscriber management) is built as swappable MCP servers, so a
brokerage's existing email provider or CRM can be plugged in without
touching the core pipeline — bring your own stack.

## Audience & Voice

The newsletter is written as if RealtyPulse (the brokerage) is writing
directly to its own buyer/seller clients — not an agent-facing digest to
forward, but something a client reads themselves. Tone: professional,
warm, locally informed.

## Goals

- A believable, polished weekly newsletter: market commentary grounded
  in real research + a handful of "spotlight" property listings with
  photos and data.
- A working scheduled send (Monday 9am) and an ad-hoc "generate & send
  now" flow for live demos.
- A fully fleshed-out dashboard: trigger/preview a send, browse an
  archive of past issues, manage the subscriber list.
- A real signup flow for subscribers (public form, confirmation,
  unsubscribe) — enough to show the whole lifecycle, not just the send.
- The outbound side (email + subscriber store) is architected as one or
  more MCP servers, so a different client's email/CRM stack is a
  swap-in, not a rewrite.
- An adapter-shaped listing data layer: synthetic now, but shaped so a
  real licensed MLS/RESO feed could replace the generator later without
  touching the rest of the pipeline.

## Non-Goals

- Not a multi-tenant SaaS product. One well-built example brand, not a
  configurable white-label system — configurability lives specifically
  in the outbound MCP layer, not throughout the app.
- Not integrating with any real MLS or listing data source. All listing
  data is synthetic.
- Not building persistence/lifecycle for listings (no price-drop/sold
  arcs) — each issue generates a fresh random batch. Confirmed simpler
  choice over a persistent evolving dataset.
- Research and image generation (Perplexity, Nano Banana) are NOT behind
  swappable integrations — they're fixed, internal implementation
  details of the product being "sold," same as Claude itself.

## Anti-Goals (would make this a failure even if "working")

- Scraping real listing sites (e.g. Zillow) for data. Explicitly
  rejected: violates Zillow's Terms of Service and is a legal and
  reputational liability for any brokerage running this product. If
  real data is ever wanted, the path in is a licensed MLS/RESO feed or
  a data provider (e.g. SimplyRETS, ATTOM), via the same adapter shape —
  not scraping.
- AI-generated images used as literal data charts/infographics — image
  models render numbers and bars unreliably. Numeric data (price, beds,
  baths, sqft) is always a real HTML/CSS component, never baked into a
  generated image.
- A dashboard that can't actually demonstrate the pipeline live — the
  ad-hoc generate/preview/send flow has to work convincingly in front of
  a client, not just the cron path.

## Content Model

Each issue contains:
1. **Market snapshot** — Perplexity researches current real-world market
   trends/news for a target metro (Khoa's call: Seattle, as a concrete,
   recognizable market for the demo — easy to swap later); Claude turns
   that research into a short written commentary section. Text only, no
   generated chart images.
2. **Spotlight listings** — 4 synthetic listings per issue (Khoa's call;
   easy to tune), each with:
   - Structured data: address, price, beds, baths, sqft, short
     description — generated to look plausible for the target metro.
   - A Nano Banana-generated (via kie.ai) photo carousel for that
     property.
   - A data component (price/beds/baths/sqft) rendered as real HTML/CSS,
     kept visually tied to the carousel but technically separate from
     the generated images.
   - Claude-written listing copy/blurb.
3. Standard branded chrome: header/logo, footer with unsubscribe link
   and physical-address-style placeholder (matches real newsletter
   conventions and CAN-SPAM requirements).

Listings are a fresh random batch every issue — no persistence or
week-to-week continuity.

## Pipeline (per issue, scheduled or ad-hoc)

1. Generate synthetic listings (internal generator, schema below).
2. Perplexity: research current market trends/news for the target metro.
3. Claude: write market commentary + per-listing copy from (1) and (2).
4. Nano Banana via kie.ai: generate a photo carousel per listing.
5. Assemble the branded HTML email (data components + copy + images).
6. Store the assembled issue (content + metadata) for the dashboard
   archive.
7. Send: scheduled path fires automatically; ad-hoc path shows a preview
   in the dashboard first, sent on explicit click.
8. Outbound send + subscriber list access go through the MCP server
   layer (see below), not called directly.

## Architecture

- **Framework**: Next.js (React UI + API routes for the dashboard and
  pipeline triggers).
- **Database**: Supabase (Postgres) — subscribers, issue archive,
  generated listings per issue, dashboard auth.
- **Hosting/Scheduling**: Vercel, with Vercel Cron firing the pipeline
  Monday 9am (timezone: America/Los_Angeles to match the Seattle metro
  choice — Khoa's call).
- **AI services** (fixed, internal — not behind MCP):
  - Claude API — copywriting/orchestration.
  - Perplexity API — market research.
  - kie.ai (Nano Banana) — property photo generation.
- **Outbound integration layer (MCP, swappable)**:
  - One or more MCP servers exposing tools such as `send_email`,
    `add_subscriber`, `list_subscribers`, `remove_subscriber`.
  - Default implementation: Gmail (send) + Supabase (subscriber store).
  - The rest of the app only calls these MCP tools — swapping a real
    client's email provider or CRM means pointing at a different MCP
    server/config, not touching pipeline code.
- **Dashboard auth**: Supabase auth, single admin account — this is an
  internal operator tool, not public.
- **Public-facing**: a simple subscribe page (email capture +
  confirmation) feeding the subscriber store through the same MCP layer.

## Dashboard (fully fleshed out)

- **Generate & Send**: manual trigger for the whole pipeline, renders a
  preview of the assembled email, explicit confirm-to-send action.
- **Issue Archive**: list of past issues (scheduled and ad-hoc), each
  viewable as rendered HTML with its generation metadata (when, which
  listings, research summary used).
- **Subscribers**: list view, add/remove, signup source/date.
- **Scheduled run status**: shows last/next scheduled send and its
  outcome (operational visibility — confirms the Monday job actually ran).

## Branding

Brand direction is Khoa's creative call, to be made concrete
during the UI/visual design pass (ui-ux-pro-max + brand asset
generation), not rigidly fixed here. Working name: **RealtyPulse**.
Direction: modern, warm-trustworthy, editorial real-estate aesthetic —
not corporate-sterile, not trendy-startup. Logo/palette/brand assets get
generated once this design is approved, per the standard brand-assets
step, and reused across the dashboard, emails, and any later mockups.

## What's Left to the Builder

- Exact Supabase schema (tables/columns) for subscribers, issues,
  listings-per-issue.
- Exact MCP server tool signatures and the Gmail send implementation
  (Gmail API vs SMTP — builder's call; Gmail API w/ OAuth is the likely
  default for reliability).
- Email HTML templating approach (e.g. react-email or MJML) — builder's
  call, pick something that renders consistently across clients.
- Synthetic listing generator's exact data ranges/plausibility rules for
  the Seattle metro.
- Signup confirmation flow details (double opt-in vs single) — builder's
  call; double opt-in is the safer default for deliverability/realism.
- Error handling/retry behavior for the three external AI APIs failing
  mid-pipeline.
- Exact page layouts/visual design for the dashboard and email — resolved
  via the normal design-mockup step before UI build, not fixed here.
