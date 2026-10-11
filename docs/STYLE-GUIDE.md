# AnchorAgentic.io Style Guide

The single visual reference for everything a person looks at: the SvelteKit web app (`anchor-agentic/web`) **and** the e2e test report (`anchor-agentic/web/e2e/core/reporter/html.ts`, plus the Markdown summary). Both must look like the same product.

**Authority.** The tokens in `anchor-agentic/web/src/routes/layout.css` (`@theme`) are the source of truth for values. This guide explains what each token is *for* and how to compose them. If the two disagree, fix the guide or the CSS in the same change; never let them drift. Rationale for the palette and scope lives in `docs/PRODUCT-CONCEPT.md` (Feature Category 6) and `docs/USER-STORIES.md` (US-047 to US-051).

## 1. Principles

1. **Functional, not decorative.** Colour, weight, borders and **functional icons** communicate state or action, nothing else. Icons come only from the fixed vocabulary in section 5 (Icons), are drawn by us as inline SVG and always sit beside their text. No icon libraries, icon fonts, illustration, decorative imagery, emoji or animation.
2. **One of everything.** One primary accent, one status colour map, one button style per level of emphasis. Reuse before inventing.
3. **Readable first.** Dense Role/Task/Agent/Skill/Workflow content must be scannable: clear hierarchy, short line length, generous spacing.
4. **Never colour alone, never icon alone.** Every status carries text (`[Draft]`, `passed`, `flaky`) in addition to colour and icon. An icon is never the only carrier of meaning.
5. **Light mode only** (US-051). Do not add a dark theme or `prefers-color-scheme` palette. `color-scheme: light` is set on purpose.

## 2. Colour

Only these tokens exist. Use the Tailwind utility (`bg-primary`, `text-ink/75`, `border-attention`), never a hex literal, in the web app.

| Token | Value | Role | Rules |
|---|---|---|---|
| `bg` | `#ffffff` | Page background; floating panels (menus) | |
| `surface` | `#f2f2f2` | Header, cards, notices, Draft badge | One step off `bg`; never nest surface in surface |
| `ink` | `#413c3e` | Body text and headings | Secondary text uses opacity: **`ink/75` or stronger** (captions, helper). `ink/70` is 4.46:1 on `bg` and 4.21:1 on `surface`, below AA for small text, so it is not allowed for text; `ink/75` is 5.12:1 and 4.80:1 (section 6). `ink/50` only for de-emphasised/disabled (it is 2.68:1, so never for an icon) |
| `primary` | `#367051` | Links, primary buttons, focus ring, **Published** and **passing** | The only accent. White text on it is allowed |
| `caution` | `#ffbf00` | **UnderReview**, **flaky** | Fill with `ink` text only. Never use as text colour on white |
| `attention` | `#ff6000` | **Removed/Deprecated**, **failed**, errors, warnings | Border, left-rule or icon only, and as an icon **only on `bg`** (3.03:1 on `bg`, 2.71:1 on `surface`, which fails 3:1). Never as small-text fill or text colour |

Turquoise, lime, golden and black from the stakeholder palette are deliberately **unused**: they fail contrast for any role. Do not wire them up.

### Status vocabulary

Lifecycle status, from `src/lib/statusStyle.ts` (reuse `STATUS_STYLE`, never re-derive it; the single map holds the classes **and** the icon name):

| Status | Treatment | Icon |
|---|---|---|
| Draft | `bg-surface text-ink/75` | quarantined |
| Published | `bg-primary text-white` | passed |
| UnderReview | `bg-caution text-ink` | flaky |
| Removed, Deprecated | `border border-attention text-ink/75` | failed |
| Archived | `text-ink/50` (icon `text-ink/75`) | skipped |

The code in `statusStyle.ts` still says `text-ink/70` on Draft, Removed and Deprecated until the section 8 follow-up lands; the target is the table above.

Badge shape: `rounded-full px-2 py-0.5 text-xs`, icon first, then the text in brackets, e.g. `[Draft]` in lists. Call sites keep their own exact text because e2e tests assert on it.

Test outcome, for the Reporter. Same tokens, same meaning, same icon:

| Outcome | Maps to | Icon | Treatment |
|---|---|---|---|
| passed | Published | passed | `primary`; badge fill `primary` with `bg` icon and text |
| flaky | UnderReview | flaky | `caution` fill with `ink` text and `ink` icon; as text on white use `ink` plus a `caution` left-rule |
| failed (blocking) | Removed | failed | `attention` border or left-rule with `ink` text; `attention` icon on `bg` only, `ink` icon anywhere else |
| skipped | Archived | skipped | `ink` icon and text (never `ink/50`, which is 2.68:1) |
| quarantined | Draft | quarantined | `ink` icon and text, on `bg` or `surface` |

## 3. Typography

- Font: system stack from `--font-sans`. No web fonts, no CDN.
- Body line-height 1.6; headings 600 weight, line-height 1.25.
- Paragraph and list text is capped at `70ch`.

| Level | Class | Use |
|---|---|---|
| Page title | `text-2xl` on exactly one `<h1>` per page | Page name |
| Section | `text-lg` on `<h2>` | Group headings (`mt-8` above, `mt-2` below) |
| Body | default (`1rem`) | Content |
| Secondary | `text-sm` (+ `text-ink/75`) | Helper text, metadata, nav, table cells |
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
| **Read-only banner** | Plain sentence starting "Read-only — ..." in `text-ink/75` on the page (US-049). Editable pages show controls; read-only pages omit them rather than disabling a wall of fields |
| **Form field** | Visible `<label>` associated to its control, helper text `text-sm text-ink/75`, error text next to the field plus a notice at the top for submit-level errors |
| **Empty state** | One sentence of `text-ink/75` saying what is missing, followed by the next action as secondary buttons |
| **Nav item** | `text-sm` link in the header; the current page is marked (see section 6) |
| **Table** | `th` left-aligned in `ink/75` weight 600, numbers right-aligned with tabular numerals, 1px `ink/10` row rules |

### Icons (US-054)

Functional icons only: an icon names a state or an action, sits beside the text that says the same thing, and is never the only carrier of meaning. Decorative or redundant icons are not added. The vocabulary is fixed; anything else needs a new story. No icon library, icon font, emoji or image file: every icon is an inline SVG drawn by us.

| Icon | Meaning | Web app use | Reporter use |
|---|---|---|---|
| passed | Success | Published badge | passed outcome, passing requirement |
| failed | Blocking failure | Removed and Deprecated badges | failed outcome, failing requirement, failures heading |
| flaky | Unstable | UnderReview badge | flaky outcome and requirement |
| skipped | Not run | Archived badge | skipped outcome |
| quarantined | Set aside, non-blocking | Draft badge | quarantined failures and the pending-decision banner |
| connected | Linked account | Settings "Connected as" line | none |
| new | Create | "+ New" menu button | none |
| next | Forward | pagination "Next" | none |
| previous | Back | pagination "Prev" | none |
| external link | Leaves the site | footer support link, only on links that leave the site | none |
| support | Sponsor the project | footer support link | none |

Drawing rules (every icon, no exceptions):

- `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.5"`, `stroke-linecap="round"`, `stroke-linejoin="round"`. No hard-coded colour. A fill is allowed only where a glyph truly needs it (none do today).
- Distinct silhouettes, so that the icons are told apart without colour: passed is a circle with a tick, failed a diamond with a cross, flaky a triangle with a bang, skipped a bare skip-forward mark, quarantined a dashed circle with a dot.
- Rendered at `1em` (`size-[1em]`, inline-block, vertically nudged to the text), so it scales with the text it sits beside. A `gap-1` separates icon and text.
- Always `aria-hidden="true"` and `focusable="false"`. The icon is a sibling of the text and never part of the accessible name: removing it leaves the name of the control or badge unchanged (`Next`, `+ New`, `[Draft]`).
- Colour is the colour of the text it sits beside (`currentColor`), with these rules: `attention` only on `bg` (see section 6), `caution` never as an icon colour (it is only a badge fill with an `ink` icon), `ink/50` never.
- Single source of truth: path data lives in `src/lib/icons.ts` (web) and is copied, not imported, into `e2e/core/reporter/icons.ts` (the Reporter must not import from `src/`). A unit test fails if the two diverge.

## 6. Accessibility baseline (WCAG 2.1 AA, US-050)

- Text contrast at least 4.5:1 (3:1 for 18px+ or 14px+ bold). Verify with the WCAG relative-luminance formula; do not eyeball and do not trust a guess. Any new colour pairing must be calculated and recorded here.
- Secondary text is `ink/75` or stronger. `ink/70` fails AA for small text (4.46:1 on `bg`, 4.21:1 on `surface`).
- Icon contrast (WCAG 1.4.11) at least 3:1 against the background it is drawn on. Calculated with the WCAG relative-luminance formula (`L = 0.2126 R + 0.7152 G + 0.0722 B` on linearised sRGB, ratio `(L1 + 0.05) / (L2 + 0.05)`); partial-opacity ink is composited over its background first. These are the only icon pairings allowed:

| Icon colour | Background | Ratio | Where | Allowed |
|---|---|---|---|---|
| `ink` | `bg` | 10.82:1 | Reporter flaky, skipped, quarantined icons on the page | yes |
| `ink` | `surface` | 9.67:1 | Reporter banner (quarantined) | yes |
| `ink` | `caution` fill | 6.55:1 | flaky badge, UnderReview badge | yes |
| `primary` | `bg` | 5.84:1 | passed icon, Settings "connected", pagination links | yes |
| `primary` | `surface` | 5.22:1 | primary-coloured icon inside a notice or header | yes |
| `bg` (white) | `primary` fill | 5.84:1 | Published badge, "+ New" button, passed badge | yes |
| `attention` | `bg` | 3.03:1 | Reporter failed icon on cards, tables, headings | yes, only on `bg` |
| `attention` | `surface` | 2.71:1 | would be the failed icon in a banner | **no**, use an `ink` icon and an `attention` left-rule |
| `ink/75` | `bg` | 5.12:1 | Archived badge icon (the text beside it stays `ink/50`) | yes |
| `ink/75` | `surface` | 4.80:1 | Draft badge icon and text | yes |
| `ink/70` | `bg` / `surface` | 4.46:1 / 4.21:1 | legacy secondary text; icon is fine (3:1), text is not (4.5:1) | icon only |
| `ink/50` | `bg` | 2.68:1 | Archived badge text | **no** for icons; the Archived icon is drawn in `ink/75` |
| `caution` | `bg` | 1.65:1 | n/a | **no** as an icon colour |
- Visible keyboard focus everywhere: the global `:focus-visible` ring is `2px primary` with `2px` offset. Never remove it.
- Touch and click targets at least 24x24 CSS px with spacing (aim for 44px on primary mobile actions).
- Every control has a programmatic name: `<label for>`, wrapping `<label>`, or `aria-label`.
- Landmarks: one `<header>`, `<nav>`, `<main>`, `<footer>`. The current nav item carries `aria-current="page"`.
- Status is never colour-only. Images and SVG charts have a text alternative (`role="img"` + `aria-label` or a `<title>`).
- Motion: none by default. If ever added, honour `prefers-reduced-motion`.

## 7. Reporter output

The e2e report is opened on its own (file or CI artifact) and cannot use Tailwind, so it **mirrors** the tokens instead of inventing its own.

- Declare the tokens as CSS custom properties with the **same names and values** as `layout.css` (`--color-bg`, `--color-surface`, `--color-ink`, `--color-primary`, `--color-caution`, `--color-attention`). No other hex values.
- One derived token is allowed in addition: `--line` = `color-mix(in srgb, var(--color-ink) 10%, transparent)`, the Reporter equivalent of `border-ink/10` (rows, cards, chart frames). Any other derived value needs an entry here first.
- Light only: no `prefers-color-scheme` block.
- Icons are the inline SVGs from section 5 (Icons), built by `e2e/core/reporter/icons.ts`, placed beside every outcome word (cards, banner, requirement badges, failures table, suite headers, chart legend). Inline only: no external request, no web font, no CDN, so the report stays one self-contained file.
- Use the outcome mapping in section 2. Cards, tables, banners and the quarantine notice use the Component recipes above translated to plain CSS (same border, radius, padding, type sizes).
- `main` is `max-width: 56rem` centred, `font-family: var(--font-sans)` value, body line-height 1.6, one `<h1>`, `<h2>` per section in document order.
- Charts: fixed rendered height, text alternative via `aria-label`/`<title>`, series colours from the tokens, outcome also readable without colour (tooltip text).
- Print: tables, cards and banners do not split across pages (`break-inside: avoid`).
- The Markdown summary (`summary.md`) uses the same outcome words (passed, flaky, failed, skipped, quarantined) and the same section order as the HTML report.

### No emoji, and the glyph tier

There is no emoji anywhere: not in the web app, the HTML report, the Markdown summary, or terminal output (no code point with `Emoji_Presentation`, no U+FE0F, no U+200D). Markdown and terminal cannot draw SVG, so they use a monochrome text-glyph tier: plain Unicode symbols that render as text, each mapped one-to-one to an SVG icon and always followed by the outcome word (`✓ Passed`, never a bare glyph). Source of truth: `e2e/core/reporter/icons.ts` (`GLYPH`).

| Icon | Glyph | Code point | Outcome word / use |
|---|---|---|---|
| passed | ✓ | U+2713 | passed |
| failed | ✗ | U+2717 | failed |
| flaky | ≈ | U+2248 | flaky |
| skipped | » | U+00BB | skipped |
| quarantined | ○ | U+25CB | quarantined |
| connected | ⇄ | U+21C4 | connected |
| new | + | U+002B | new |
| next | › | U+203A | next |
| previous | ‹ | U+2039 | previous |
| external link | ⇗ | U+21D7 | external link |
| support | ♡ | U+2661 | support |

Do not use ✔ ✖ ⚠ ♥ ↗ or similar: they have emoji forms that browsers and terminals may substitute. Every glyph above has `Emoji=No` in Unicode and needs no variation selector. The six outcome rows are pairwise distinct.

## 8. Known deviations (to fix, then delete the row)

| Where | Deviation | Target |
|---|---|---|
| `src/routes/+layout.svelte` nav | No `aria-current="page"` on the active link | Section 6 |
| 78 uses of `text-ink/70` in 17 files under `src/` (including `Draft` and `Removed`/`Deprecated` in `src/lib/statusStyle.ts`) | Secondary text at 4.46:1 on `bg` and 4.21:1 on `surface`, below AA for small text | `text-ink/75` (section 2); find them with `grep -rn "ink/70" src` |
| `e2e/core/log.ts` `log.action` and `e2e/tests/user-actions.spec.ts` | `log.action` still prefixes lines with an emoji because the spec asserts that exact string | Glyph tier (section 7); change `log.action` and the spec's expected lines together |

## 9. Changing this guide

1. Change the tokens in `layout.css` and this guide together, in one commit.
2. A new colour needs a recorded contrast calculation and a role; otherwise it is rejected.
3. After a token change, re-run the web e2e suite and regenerate the report to confirm both surfaces still match.
