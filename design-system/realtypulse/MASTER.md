# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** RealtyPulse (operator dashboard)
**Generated:** 2026-10-12
**Category:** Internal admin tool / operator dashboard (not a marketing site)
**Design Dials:** Variance 4/10 (Balanced / Modern) | Motion 3/10 (Subtle) | Density 7/10 (Standard)

**Provenance note:** `ui-ux-pro-max`'s auto-matched `--design-system` pattern for this query returned
landing-page-shaped results (hero-centric, dark dev-tool aesthetic) that didn't fit an internal,
warm-editorial operator tool. Typography below is a verified match (`--domain typography`,
"Calistoga + Inter," tagged "warm, editorial... operations platforms, analytics dashboards").
Color is synthesized from the design doc's explicit brief ("modern, warm-trustworthy, editorial
real-estate aesthetic — not corporate-sterile, not trendy-startup") plus partial signal from
`--domain color` searches, since no database palette combined "warm" with "real estate" — this is
Khoa's/the builder's call, not a verified palette-database hit. The page pattern and component
specs below are written directly from the design doc's 4-screen Dashboard section, not from the
auto-matcher's landing-page taxonomy.

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#B4502E` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#6B7256` | `--color-secondary` |
| On Secondary | `#FFFFFF` | `--color-on-secondary` |
| Accent/CTA | `#B4502E` | `--color-accent` |
| On Accent/CTA | `#FFFFFF` | `--color-on-accent` |
| Background | `#FAF7F2` | `--color-background` |
| Foreground | `#2A211C` | `--color-foreground` |
| Card | `#FFFDF9` | `--color-card` |
| Card Foreground | `#2A211C` | `--color-card-foreground` |
| Muted | `#F0E9E1` | `--color-muted` |
| Muted Foreground | `#6B6058` | `--color-muted-foreground` |
| Border | `#E3D8CC` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| On Destructive | `#FFFFFF` | `--color-on-destructive` |
| Success | `#4D7C4D` | `--color-success` |
| Ring | `#B4502E` | `--color-ring` |

**Color Notes:** Warm terracotta primary (clay/brick — real estate without being literal), sage
secondary, warm cream background instead of cold slate/white. Verify every text/fill pairing at
4.5:1 minimum with an actual contrast checker before shipping — these are a starting palette, not
pre-verified.

### Typography

- **Heading Font:** Calistoga (display serif-adjacent, adds warmth to headings — avoid italic
  except true editorial callouts)
- **Body/UI Font:** Inter (16–18px body, clean and highly legible for dense admin screens)
- **Data/Label Font:** JetBrains Mono, 12px uppercase, tracking-wide — for stat labels, counts,
  and timestamps (subscriber count, last-run time) where a monospace reinforces "this is a precise
  number," not a design accent
- **Mood:** warm, editorial, human, operations platform — verified match, not synthesized
- **Google Fonts:**
```css
@import url('https://fonts.googleapis.com/css2?family=Calistoga&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
```
- **Scale:** Page title 28–32px (Calistoga) · Section heading 20–22px (Calistoga) · Body 16px
  (Inter) · Label/meta 12px uppercase tracking-[0.04em] (JetBrains Mono)

### Spacing Variables

*Density: 7/10 — Standard-to-dense, appropriate for an admin dashboard*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(42,33,28,0.06)` | Subtle lift (table rows) |
| `--shadow-md` | `0 4px 6px rgba(42,33,28,0.08)` | Cards |
| `--shadow-lg` | `0 10px 15px rgba(42,33,28,0.10)` | Modals, dropdowns, preview panel |

---

## Component Specs

### Buttons

```css
.btn-primary {
  background: var(--color-primary);
  color: var(--color-on-primary);
  padding: 12px 20px;
  border-radius: 8px;
  font-weight: 600;
  min-height: 44px;
  transition: background 150ms ease, transform 150ms ease;
  cursor: pointer;
}
.btn-primary:hover { background: #9c4327; }
.btn-primary:focus-visible { outline: 2px solid var(--color-ring); outline-offset: 2px; }

.btn-secondary {
  background: transparent;
  color: var(--color-foreground);
  border: 1px solid var(--color-border);
  padding: 12px 20px;
  border-radius: 8px;
  font-weight: 600;
  min-height: 44px;
  cursor: pointer;
}

.btn-destructive {
  background: var(--color-destructive);
  color: var(--color-on-destructive);
  padding: 12px 20px;
  border-radius: 8px;
  font-weight: 600;
  min-height: 44px;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-sm);
}
```

### Status badges (for scheduled-run status and issue trigger type)

```css
.badge-success { background: #E6EFE6; color: var(--color-success); }
.badge-pending { background: var(--color-muted); color: var(--color-muted-foreground); }
.badge-failed  { background: #FBE3E3; color: var(--color-destructive); }
/* badges use color + a text label ("Sent"/"Pending"/"Failed"), never color alone */
```

### Data tables (Issue Archive, Subscribers)

- Wrap every table in a horizontally-scrollable container on narrow viewports (`overflow-x-auto`)
  — do not let a wide table break the page layout.
- Subscribers list gets a checkbox column + a bulk-action bar (bulk remove) once ≥1 row is
  selected, instead of only per-row actions — editing one subscriber at a time doesn't scale.
- Row height tall enough for a 44px touch target on the row's action button.

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 16px;
  background: var(--color-card);
  transition: border-color 150ms ease;
}
.input:focus { border-color: var(--color-primary); outline: none; box-shadow: 0 0 0 3px #B4502E26; }
```

---

## Page Pattern: Admin Dashboard Shell

Not a landing/marketing pattern — this is an internal, authenticated operator tool.

- **Navigation:** persistent left sidebar (desktop) / collapsible top drawer (mobile) with 4 items
  matching the spec's dashboard sections: Generate & Send, Issue Archive, Subscribers, Schedule
  Status. Active item visually distinct (filled background, not just color change, for
  colorblind-safe distinction).
- **Top bar:** brand wordmark/icon (left), signed-in admin account + sign-out (right).
- **Content area:** one primary action or data view per screen, card-based layout, generous
  whitespace (density 7/10, not cramped).
- **Generate & Send specifically:** two-step flow — trigger generates a preview (rendered email
  HTML in an iframe or styled container), explicit confirm button to actually send. Never send on
  the same click that triggers generation.

---

## Anti-Patterns (Do NOT Use)

- ❌ Glassmorphism/heavy blur effects — reads as "trendy-startup," which the brief explicitly
  rejects
- ❌ A dark, code-editor-style theme — this is a warm, editorial-leaning tool, not a dev dashboard
- ❌ Emojis as icons — use SVG icons (Heroicons/Lucide)
- ❌ Missing `cursor-pointer` on clickable elements
- ❌ Color-only status indicators (always pair with a text label)
- ❌ Instant state changes — use 150–300ms transitions
- ❌ Invisible focus states
- ❌ Sending an email on the same action that generates the preview

---

## Pre-Delivery Checklist

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from one consistent set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover + focus states with visible, smooth transitions (150–300ms)
- [ ] Text contrast verified at 4.5:1 minimum (actual check, not assumed from hex values)
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px; no horizontal scroll except inside a table wrapper
- [ ] Every status badge pairs color with a text label
- [ ] Generate vs. Send are two distinct, explicit actions
