# Flow Models Design — AnchorAgentic.io e2e

Page Models and Flow Models for the Playwright suite in `anchor-agentic/web/e2e`.

```
e2e/
├── *.spec.ts                  # Test scripts — thin: arrange via flows, assert via pages
└── business/
    ├── flows/    *.flow.ts    # Flow Models: user journeys that orchestrate pages
    ├── pages/    *.page.ts    # Page Models: selectors + single-page interactions/assertions
    ├── support/               # test-data (identities, publishable content), log, live-supabase guard
    └── docs/FLOW_MODELS_DESIGN.md
```

## Layering rules

| Layer | Owns | Must not |
|---|---|---|
| **Spec** | scenario narrative, unique test data (`stamp`), the *final* business assertion | contain selectors or multi-step UI sequences |
| **Flow Model** | multi-page journeys (`registerNewUser`, `createPublishableAgent`, `publishItem`), emoji logging, cross-user orchestration | contain raw selectors (delegates to pages) |
| **Page Model** | locators, one-page actions (`rate()`, `addStep()`), page-level assertions (`expectStatus()`) | navigate through multiple pages in one method (except redirects that the app itself performs, e.g. `create()` → detail page) |

Conventions: every flow logs with `log.step / ok / warn / fail` (▶️ ✅ ⚠️ ❌); action methods that POST a SvelteKit form
action wait on that response (`waitForAction('publish')`); forms are only filled after `waitForHydration()` on
freshly-loaded pages, because `use:enhance` resets a form that was filled before hydration.

## Page Model inventory

| Page Model | Route | Used by |
|---|---|---|
| `BasePage` | header/footer shared by all pages (Log out, Log in, donation link, alert) | all pages |
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
- **New publish gate** → adjust `support/test-data.ts` (`PUBLISHABLE`) and/or `AuthoringFlow.createPublishableAgent`.
- **New item type** → add `New<Type>Page` + `<Type>DetailPage extends ItemDetailPage`, then extend `AuthoringFlow`.
- Known overlap kept on purpose: `LegacySandboxPage` mirrors the pre-v1.1 generic Sandbox that `/sandbox` still serves; delete it together with the route.
