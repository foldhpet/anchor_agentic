---
paths:
  - "anchor-agentic/web/**"
---

# Web (SvelteKit, Cloudflare Pages)

- Formatting is Prettier-configured (the existing tree is not fully Prettier-clean, so format only files you touch and keep diffs focused): tabs, single quotes, no trailing commas, print width 100, Svelte and Tailwind plugins. Use `npx prettier --write <file>` on the files you touch; do not run `npm run format` (it rewrites the whole tree).
- Data loading and mutations go in `+page.server.ts` (load + form actions) and call the API through `src/lib/api/client.ts`. Add response types to `src/lib/api/types.ts`. Do not call Supabase directly for anything the API already exposes.
- Routes follow the existing layout: `/library` (My Sandbox), `/library/all` (All Sandbox), `/marketplace/[itemType]/[id]`, `/roles|tasks|agents|skills|workflows/...`.
- Anonymous visitors only see the Marketplace; guard Sandbox routes server-side, not just by hiding links.
- Forms use `use:enhance`. A form filled before hydration is reset, which matters for e2e (see below).

## e2e (Playwright, Flow Model pattern)

Follow `e2e/business/docs/FLOW_MODELS_DESIGN.md`:
- **Spec** (`e2e/*.spec.ts`): thin; scenario narrative, unique test data, the final business assertion. No selectors.
- **Flow Model** (`business/flows/*.flow.ts`): multi-page journeys; log with `log.step/ok/warn/fail`. No raw selectors.
- **Page Model** (`business/pages/*.page.ts`): locators, one-page actions, page assertions. Extend `BasePage`.
- Wait on form-action responses (`waitForAction('...')`) and call `waitForHydration()` before filling forms.
- New pages need a Page Model, and new journeys a Flow Model; update the inventory table in the design doc.

Before declaring done, run from `anchor-agentic/web`: `npm run check` and `npm run lint`. e2e (`npm run test:e2e`) needs live Supabase credentials; say so if it was not run.
