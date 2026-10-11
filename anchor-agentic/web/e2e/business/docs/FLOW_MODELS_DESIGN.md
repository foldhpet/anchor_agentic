# Flow Models Design — AnchorAgentic.io e2e

Page Models and Flow Models for the Playwright suite in `anchor-agentic/web/e2e`.

The suite follows the Tri-Layer Testing Architecture (`docs/TRI-LAYER.md`): test scripts, application-specific business logic, and reusable core libraries.

```
e2e/
├── tests/                     # LAYER 1 — Test Scripts (runnable; thin: arrange via flows, assert via pages)
│   ├── *.spec.ts
│   └── global-setup.ts / global-teardown.ts   # Playwright hooks (create/delete the shared personas)
├── business/                  # LAYER 2 — Business Logic (everything specific to AnchorAgentic.io)
│   ├── flows/    *.flow.ts    # Flow Models: user journeys that orchestrate pages
│   ├── pages/    *.page.ts    # Page Models: selectors + single-page interactions/assertions
│   ├── support/               # Environment/test data: test-data, personas, live-supabase guard
│   └── docs/FLOW_MODELS_DESIGN.md
└── core/                      # LAYER 3 — Core Libraries (application-independent, reusable in other TAFs)
    ├── base.page.ts           # Base Page: goto, url, currentId, waitForNetworkIdle
    └── log.ts                 # Logger
```

Dependency direction is strictly downward: `tests` -> `business` -> `core`. `core` must not import from `business` or `tests`, and must not mention AnchorAgentic.io routes, locators or test data. Anything that does belongs in `business`.

## Layering rules

| Layer | Owns | Must not |
|---|---|---|
| **Spec** | scenario narrative, unique test data (`stamp`), the *final* business assertion | contain selectors or multi-step UI sequences |
| **Flow Model** | multi-page journeys (`registerNewUser`, `createPublishableAgent`, `publishItem`), emoji logging, cross-user orchestration | contain raw selectors (delegates to pages) |
| **Page Model** | locators, one-page actions (`rate()`, `addStep()`), page-level assertions (`expectStatus()`) | navigate through multiple pages in one method (except redirects that the app itself performs, e.g. `create()` → detail page); call `click`/`fill`/`selectOption` directly for interactions the User Action library covers |
| **User Action** (`core/user-actions.ts`) | application-independent interactions used in several places (`goTo`, `fill`, `fillSecret`, `select`, `click`, `clickAndWaitForAction`, `clickAndWaitForUrl`, `waitForUrl`); one log line per action saying what it did | know any route, label or locator of AnchorAgentic.io; contain assertions |

Conventions: every flow logs with `log.step / ok / warn / fail` (glyph-tagged, no emoji: › ✓ ≈ ✗; see docs/STYLE-GUIDE.md section 7); action methods that POST a SvelteKit form
action wait on that response (`actions.clickAndWaitForAction(button, 'publish', 'Publish')`); forms are only filled after
`waitForHydration()` on freshly-loaded pages, because `use:enhance` resets a form that was filled before hydration.
Page Models reach the User Actions through `this.actions` (created by the core `BasePage`). An interaction moves into
`core/user-actions.ts` once it is used in more than one place; a one-off interaction stays in its Page Model.

## Reporter

`core/reporter/` is an application-independent Playwright reporter, enabled in `playwright.config.ts` next to the `list`
reporter. After every run it prints a summary and appends it to `e2e/reports/history.json` (newest 100 runs, git-ignored;
the latest run is also in `latest.json`):

- suite overview (per spec file), pass ratio (`(passed + flaky) / executed`), min / avg / max test duration (last attempt)
- flaky tests (failed, then passed on retry) and the ones that are flaky most often across the history
- failed tests sorted into **product bug**, **test automation bug** and **server-side error** from the error text
  (`core/reporter/classify.ts`). It is a heuristic; a test can pin its category with
  `test.info().annotations.push({ type: 'failure-category', description: 'product-bug' })`
  (values: `product-bug`, `test-automation-bug`, `server-error`).

Beyond the summary, every run also produces (all under `e2e/reports/`, git-ignored):

- **Per-test history**: each run stores every test's status and duration, so flake rate and "getting slower" (latest vs
  the average of earlier runs, needs 3 earlier runs) are available per test.
- **Server-side errors**: the reporter reads the output of the web servers and counts the API's structured error line
  (`{"requestId","path","method","error"}`, written by the API's error handler for every 5xx) once per request.
- **Requirements**: IDs matching `US-\d{3}` found in a test's title path or tags are linked to the test, and each story is
  reported as passing / flaky / failing. A range such as `(US-005–US-013)` in a describe title is ignored; tag the test
  (`test('...', { tag: '@US-012' }, ...)`) for precise links.
- **Failure artifacts**: screenshot, trace and page snapshot of every failed attempt are copied to
  `artifacts/<run>/<test>/` (Playwright wipes `test-results` on the next run). The latest 20 runs are kept.
- **`report.html`**: self-contained page (pass-ratio and run-time trends over the history, failures with artifact links,
  suites, requirements, flakiest and slowing tests, quarantine decisions, server errors).
- **`summary.md`**: Markdown for CI. It is also appended to the GitHub Actions job summary when `GITHUB_STEP_SUMMARY` is
  set. To comment on a pull request: `gh pr comment <number> --body-file e2e/reports/summary.md`.

### Quarantine needs a person

A test that was flaky in 3 of its last 10 runs is *proposed* for quarantine; the reporter never quarantines on its own.
After the run it prints a warning that says what quarantine risks and asks `[q]uarantine / [k]eep blocking / [l]ater`
when a person is at a terminal. Without a terminal (CI, piped output) it only warns and points to the CLI:

```
npm run e2e:quarantine -- list              decisions and tests waiting for one
npm run e2e:quarantine -- decide            warn about each candidate and ask
npm run e2e:quarantine -- release "<key>"   drop a decision
```

Decisions are saved in `e2e/quarantine.json`, which is **committed** so the team shares them. A quarantined test still
runs and is still reported, but if only quarantined tests fail the run exits successfully. `keep-blocking` records that a
person looked and does not want it quarantined, so it is not proposed again; delete the entry to be asked again.

The calculations are pure functions covered by `core/reporter/*.test.ts` (`npm run test:unit`).

## Page Model inventory

| Page Model | Route | Used by |
|---|---|---|
| `AnchorBasePage` (`business/pages/anchor-base.page.ts`) | application-specific base page; extends the core `BasePage`; adds header/footer (Log out, Log in, donation link, alert), `waitForHydration` | all pages |
| `RegisterPage` | `/register` | AuthFlow |
| `LoginPage` | `/login` | AuthFlow, permission-boundary spec |
| `MarketplacePage` | `/` (search `q`, filter `type`, `role`) | MarketplaceFlow, sustainability spec |
| `MarketplaceDetailPage` | `/marketplace/[itemType]/[id]` (rate, clone, report) | MarketplaceFlow, CloneFlow |
| `MySandboxPage` | `/library` (grouped by type, status badges, "Show archived") | SandboxFlow, clone spec |
| `AllSandboxPage` | `/library/all` (read-only, searchable) | SandboxFlow |
| `LegacySandboxPage` / `LegacyAllSandboxPage` | `/sandbox`, `/sandbox/all` (original generic items; still routed) | SandboxFlow (US-004) |
| `ItemDetailPage` *(abstract)* | shared detail behaviour: status, Publish/Archive/Clone, provenance, Version History | all detail pages below |
| `NewRolePage` / `RoleDetailPage` | `/roles/new`, `/roles/[id]` (inline "create Task" form) | AuthoringFlow, SandboxFlow |
| `TaskDetailPage` | `/tasks/[id]` | SandboxFlow, export spec |
| `NewAgentPage` / `AgentDetailPage` | `/agents/new`, `/agents/[id]` (Task assignment) | AuthoringFlow, CloneFlow |
| `NewSkillPage` / `SkillDetailPage` | `/skills/new`, `/skills/[id]` | AuthoringFlow, CloneFlow, SandboxFlow |
| `NewWorkflowPage` / `WorkflowDetailPage` | `/workflows/new`, `/workflows/[id]` (ordered steps) | AuthoringFlow |

The removed list pages (`/roles`, `/agents`, `/skills`, `/workflows`) have no models; My Sandbox replaced them.

## Flow Model inventory

| Flow Model | Journeys | Pages used |
|---|---|---|
| `AuthFlow` | `registerNewUser`, `logIn`, `logOut`, `registerLogOutAndLogBackIn`, `registerDuplicateEmail`, `logInWithInvalidCredentials` | Register, Login |
| `SessionFlow` | `startAnonymous`, `startRegistered` — isolated browser contexts for "other user" scenarios | (AuthFlow) |
| `AuthoringFlow` | `createRole`, `createRoleWithTasks`, `createAgentForRole`, `assignTasks`, `createPublishableAgent`, `createSkill`, `createWorkflow(WithSteps)`, `editStep`, `removeStepAndExpectRemaining`, `reorderAndRemoveSteps` | New*/…Detail pages |
| `PublishFlow` | `publishItem`, `publishExpectingRejection` (quality gates) | ItemDetailPage |
| `CloneFlow` | `cloneFromSandboxUrl`, `cloneFromMarketplace`, `expectCloneCount` | ItemDetailPage, MarketplaceDetailPage |
| `MarketplaceFlow` | `browseAndOpenDetail`, `expectFound`, `expectFilteredOut`, `rateTwiceAndVerifyUpsert`, `expectAggregateWithoutRatingControl`, `expectDraftNotFound` | MarketplacePage, MarketplaceDetailPage |
| `SandboxFlow` | `expectLibraryGroupedWithDrafts`, `archiveTaskAndVerifyHidden`, `saveRevisionsAndInspectHistory`, `expectReadOnlyAcrossUsers`, `nonOwnerCannotEdit` | MySandbox, AllSandbox, Legacy*, Task/Role/Skill detail |
| `ExportFlow` | `exportSingleFile`, `exportWorkflowBundle`, `expectForbidden`, `expectDanglingStepRejection` (HTTP against the `/export/[type]/[id]` proxy) | — (API parity, US-039) |

## Typical user flows

### 1. Registration and session (US-001, US-002)

```
 Anonymous ──► RegisterPage.open ──► fillAndSubmit ──► "/" (logged in)
                                                          │
                                  LoginPage ◄── logOut ◄──┘
                                      │
                       fillAndSubmit ─┴─► "/" (logged in)        wrong password ─► "Invalid email or password."
                                                                 same email twice ─► "already exists" error
```
Flow: `AuthFlow` · Tests: `auth.spec.ts` (3), and the first step of every other spec.

### 2. Author a publishable Agent (Epic B)

```
 NewRolePage.create ─► RoleDetailPage ─► createTask × n
        │                                      │
        └────────► NewAgentPage.create(role, prompt) ─► AgentDetailPage ─► assignTask × n
                        (one Agent per Role: a 2nd attempt shows "All of your Roles already have an Agent.")
```
Flow: `AuthoringFlow.createPublishableAgent` · Tests: clone, marketplace (×3), domain-authoring, export, sandbox-library.

### 3. Build a Workflow (Epic B, US-012)

```
 NewWorkflowPage.create ─► WorkflowDetailPage ─► addStep(TASK|AGENT|SKILL) × n ─► moveStepUp / removeStep ─► reload (persisted)
```
Flow: `AuthoringFlow.createWorkflowWithSteps` + `reorderAndRemoveSteps` · Tests: domain-authoring, export (×3), marketplace.

### 4. Publish to the Marketplace (Epic C / Epic J gates)

```
 ItemDetailPage.publish ──► gates: Agent ≥1 Task & prompt ≥40 chars · Skill content ≥80 chars · Workflow description ≥20 chars
        │ pass                                   │ fail
        ▼                                        ▼
 "Published at vN."  ──► visible in Marketplace   alert "quality_check_failed" / "agent_has_no_tasks" (PublishFlow.publishExpectingRejection)
```
Flow: `PublishFlow` · Tests: clone, marketplace, sandbox-library.

### 5. Discover, rate and clone (Epic E/F/G)

```
 Anonymous/User ─► MarketplacePage (q / type / role) ─► MarketplaceDetailPage ─┬─ rate(n)  [registered only; upsert]
                                                                               └─ cloneIntoSandbox ─► new Draft in My Sandbox
                                                                                      ("Cloned from …", source: "Cloned N times")
 Draft item's /marketplace URL ─► 404 for anonymous and non-owner visitors (never listed either)
```
Flows: `MarketplaceFlow`, `CloneFlow`, `SessionFlow` · Tests: marketplace (×4), clone (×2).

### 6. Sandbox management (Epic D)

```
 MySandboxPage (grouped by type, [Draft]/[Published]) ─► open item ─► archive ─► hidden unless "Show archived"
 RoleDetailPage.saveDescription × n ─► Version History (n+1 snapshots) ─► open oldest (read-only <pre>) ─► Close
 Other user ─► AllSandboxPage?q= ─► result link ─► read-only detail (no Save/Archive/forms)
```
Flow: `SandboxFlow` · Tests: sandbox-library (×3), permission-boundary.

### 7. Export to `.claude` (Epic H)

```
 owner ─► GET /export/AGENT|SKILL|WORKFLOW/[id] ─► files[]  (.claude/agents · skills/<slug> · commands)
 Workflow with Agent step ─► command file + bundled agent file
 non-owner ─► 403        archived step target ─► 400 dangling_step_reference
```
Flow: `ExportFlow` · Tests: export (×6).

### 8. Access guard and donation link (US-003, US-041)

```
 anonymous GET /sandbox | /sandbox/all ─► 303 /login?reason=sandbox (banner)       anonymous "/" ─► donation link (_blank, noopener)
```
Flows: none needed (single-page assertions through `LoginPage`/`MarketplacePage`) · Tests: permission-boundary (3), sustainability (2).

## Test → flow map

| Spec | Flows used |
|---|---|
| `auth.spec.ts` | AuthFlow |
| `domain-authoring.spec.ts` | AuthFlow, AuthoringFlow, SessionFlow |
| `clone.spec.ts` | AuthFlow, AuthoringFlow, PublishFlow, CloneFlow, SessionFlow |
| `marketplace.spec.ts` | AuthFlow, AuthoringFlow, PublishFlow, MarketplaceFlow, CloneFlow, SessionFlow |
| `sandbox-library.spec.ts` | AuthFlow, AuthoringFlow, PublishFlow, SandboxFlow, SessionFlow |
| `export.spec.ts` | AuthFlow, AuthoringFlow, ExportFlow, SessionFlow |
| `permission-boundary.spec.ts` | SessionFlow, SandboxFlow (+ LoginPage / MarketplacePage directly) |
| `sustainability.spec.ts` | MarketplacePage directly |

## Maintenance notes

- **UI change** → edit the single page model; specs and flows stay untouched.
- **New publish gate** → adjust `business/support/test-data.ts` (`PUBLISHABLE`) and/or `AuthoringFlow.createPublishableAgent`.
- **New item type** → add `New<Type>Page` + `<Type>DetailPage extends ItemDetailPage`, then extend `AuthoringFlow`.
- Known overlap kept on purpose: `LegacySandboxPage` mirrors the pre-v1.1 generic Sandbox that `/sandbox` still serves; delete it together with the route.
