# AnchorAgentic.io Style Guide

The single visual reference for everything a person looks at: the SvelteKit web app (`anchor-agentic/web`) **and** the e2e test report (`anchor-agentic/web/e2e/core/reporter/html.ts`, plus the Markdown summary). Both must look like the same product.

**Authority.** The tokens in `anchor-agentic/web/src/routes/layout.css` (`@theme`) are the source of truth for values. This guide explains what each token is *for* and how to compose them. If the two disagree, fix the guide or the CSS in the same change; never let them drift. Rationale for the palette and scope lives in `docs/PRODUCT-CONCEPT.md` (Feature Category 6) and `docs/USER-STORIES.md` (US-047 to US-051).

## 1. Principles

1. **Functional, not decorative.** Colour, weight and borders communicate state or action, nothing else. No icon sets, illustration or animation (v1.1 scope).
2. **One of everything.** One primary accent, one status colour map, one button style per level of emphasis. Reuse before inventing.
3. **Readable first.** Dense Role/Task/Agent/Skill/Workflow content must be scannable: clear hierarchy, short line length, generous spacing.
4. **Never colour alone.** Every status carries text (`[Draft]`, `passed`, `flaky`) in addition to colour.
5. **Light mode only** (US-051). Do not add a dark theme or `prefers-color-scheme` palette. `color-scheme: light` is set on purpose.

## 2. Colour

Only these tokens exist. Use the Tailwind utility (`bg-primary`, `text-ink/70`, `border-attention`), never a hex literal, in the web app.

| Token | Value | Role | Rules |
|---|---|---|---|
| `bg` | `#ffffff` | Page background; floating panels (menus) | |
| `surface` | `#f2f2f2` | Header, cards, notices, Draft badge | One step off `bg`; never nest surface in surface |
| `ink` | `#413c3e` | Body text and headings | Secondary text uses opacity: `ink/70` (captions, helper), `ink/50` only for de-emphasised/disabled |
| `primary` | `#367051` | Links, primary buttons, focus ring, **Published** and **passing** | The only accent. White text on it is allowed |
| `caution` | `#ffbf00` | **UnderReview**, **flaky** | Fill with `ink` text only. Never use as text colour on white |
| `attention` | `#ff6000` | **Removed/Deprecated**, **failed**, errors, warnings | Border, left-rule or icon only (about 3:1 contrast). Never as small-text fill or text colour |

Turquoise, lime, golden and black from the stakeholder palette are deliberately **unused**: they fail contrast for any role. Do not wire them up.

### Status vocabulary

Lifecycle status, from `src/lib/statusStyle.ts` (reuse `STATUS_STYLE`, never re-derive it):

| Status | Treatment |
|---|---|
| Draft | `bg-surface text-ink/70` |
| Published | `bg-primary text-white` |
| UnderReview | `bg-caution text-ink` |
| Removed, Deprecated | `border border-attention text-ink/70` |
| Archived | `text-ink/50` |

Badge shape: `rounded-full px-2 py-0.5 text-xs`, text in brackets, e.g. `[Draft]` in lists. Call sites keep their own exact text because e2e tests assert on it.

Test outcome, for the Reporter. Same tokens, same meaning:

| Outcome | Maps to | Treatment |
|---|---|---|
| passed | Published | `primary` |
| flaky | UnderReview | `caution` fill with `ink` text; as text on white use `ink` plus a `caution` left-rule |
| failed (blocking) | Removed | `attention` border or left-rule with `ink` text |
| skipped / quarantined | Archived / Draft | `ink/50` or `surface` |

## 3. Typography

- Font: system stack from `--font-sans`. No web fonts, no CDN.
- Body line-height 1.6; headings 600 weight, line-height 1.25.
- Paragraph and list text is capped at `70ch`.

| Level | Class | Use |
|---|---|---|
| Page title | `text-2xl` on exactly one `<h1>` per page | Page name |
| Section | `text-lg` on `<h2>` | Group headings (`mt-8` above, `mt-2` below) |
| Body | default (`1rem`) | Content |
| Secondary | `text-sm` (+ `text-ink/70`) | Helper text, metadata, nav, table cells |
| Badge / caption | `text-xs` | Status badges, fine print |

Heading levels never skip (`h1` to `h2` to `h3`). Pick the level for structure, then the class for size.

## 4. Layout and spacing

- Page shell (`+layout.svelte`): header with the global nav, `<main class="mx-auto w-full max-w-4xl flex-1 px-4 py-6">`, footer. Content never goes wider than `max-w-4xl` (about 56rem); the Reporter uses the same measure.
- Vertical rhythm uses the Tailwind scale only: `mt-1` (tight), `mt-2` (related), `mt-4` (block), `mt-6`/`mt-8` (section). `gap-1`/`gap-2` inside rows, `gap-4` between nav items.
- Mobile first: single column below `sm`, wrap rather than scroll. Wide tables sit in `overflow-x-auto`.
- Control sizing: `px-3 py-1.5`, `rounded-md`. Corner radius is `rounded-md` for controls and cards, `rounded-full` for badges only.

## 5. Components

Compose from these. A new pattern needs a reason and an entry here.

| Component | Recipe |
|---|---|
| **Link** | Global styling from `layout.css` (primary, underlined). Add `no-underline` only for navigation chrome and button-looking links |
| **Primary button** | `rounded-md bg-primary px-3 py-1.5 text-white` (one per view for the main action) |
| **Secondary button / link-button** | `rounded-md border border-ink/15 px-3 py-1.5 no-underline` |
| **Quiet button** | `rounded-md px-2 py-1.5 hover:bg-ink/5` (Log out, toolbar actions) |
| **Disabled** | `disabled:opacity-40`, plus the `disabled` attribute; say why nearby |
| **List row / card** | `rounded-md border border-ink/10 p-3`, name as a link in `font-semibold`, badge after |
| **Notice** | `role="status"` (or `role="alert"` for errors), `rounded-md border-l-4 border-attention bg-surface px-4 py-3 text-ink`. Existing instance: `DegradedNotice.svelte`. Reuse it for degraded or partial content |
| **Read-only banner** | Plain sentence starting "Read-only — ..." in `text-ink/70` on the page (US-049). Editable pages show controls; read-only pages omit them rather than disabling a wall of fields |
| **Form field** | Visible `<label>` associated to its control, helper text `text-sm text-ink/70`, error text next to the field plus a notice at the top for submit-level errors |
| **Empty state** | One sentence of `text-ink/70` saying what is missing, followed by the next action as secondary buttons |
| **Nav item** | `text-sm` link in the header; the current page is marked (see section 6) |
| **Table** | `th` left-aligned in `ink/70` weight 600, numbers right-aligned with tabular numerals, 1px `ink/10` row rules |

## 6. Accessibility baseline (WCAG 2.1 AA, US-050)

- Text contrast at least 4.5:1 (3:1 for 18px+ or 14px+ bold). Verify with the WCAG relative-luminance formula; do not eyeball and do not trust a guess. Any new colour pairing must be calculated and recorded here.
- Visible keyboard focus everywhere: the global `:focus-visible` ring is `2px primary` with `2px` offset. Never remove it.
- Touch and click targets at least 24x24 CSS px with spacing (aim for 44px on primary mobile actions).
- Every control has a programmatic name: `<label for>`, wrapping `<label>`, or `aria-label`.
- Landmarks: one `<header>`, `<nav>`, `<main>`, `<footer>`. The current nav item carries `aria-current="page"`.
- Status is never colour-only. Images and SVG charts have a text alternative (`role="img"` + `aria-label` or a `<title>`).
- Motion: none by default. If ever added, honour `prefers-reduced-motion`.

## 7. Reporter output

The e2e report is opened on its own (file or CI artifact) and cannot use Tailwind, so it **mirrors** the tokens instead of inventing its own.

- Declare the tokens as CSS custom properties with the **same names and values** as `layout.css` (`--color-bg`, `--color-surface`, `--color-ink`, `--color-primary`, `--color-caution`, `--color-attention`). No other hex values.
- Light only: no `prefers-color-scheme` block.
- Use the outcome mapping in section 2. Cards, tables, banners and the quarantine notice use the Component recipes above translated to plain CSS (same border, radius, padding, type sizes).
- `main` is `max-width: 56rem` centred, `font-family: var(--font-sans)` value, body line-height 1.6, one `<h1>`, `<h2>` per section in document order.
- Charts: fixed rendered height, text alternative via `aria-label`/`<title>`, series colours from the tokens, outcome also readable without colour (tooltip text).
- Print: tables, cards and banners do not split across pages (`break-inside: avoid`).
- The Markdown summary (`summary.md`) uses the same outcome words (passed, flaky, failed, quarantined) and the same section order as the HTML report.

## 8. Known deviations (to fix, then delete the row)

| Where | Deviation | Target |
|---|---|---|
| `src/routes/+layout.svelte` nav | No `aria-current="page"` on the active link | Section 6 |

## 9. Changing this guide

1. Change the tokens in `layout.css` and this guide together, in one commit.
2. A new colour needs a recorded contrast calculation and a role; otherwise it is rejected.
3. After a token change, re-run the web e2e suite and regenerate the report to confirm both surfaces still match.
