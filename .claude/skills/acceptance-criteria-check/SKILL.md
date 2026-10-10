---
name: acceptance-criteria-check
description: Verify an implemented user story against each of its acceptance criteria in docs/USER-STORIES.md, citing code and test evidence for every criterion
---

# Acceptance Criteria Check

Re-checks a finished (or in-progress) change against the acceptance criteria of one user story. This is step 4 of the development workflow in `CLAUDE.md`.

## When to use

- After implementing a story, before calling it done
- When reviewing someone else's change that claims to implement a story
- As step 5 of the `/story` command

## Procedure

1. **Locate the story.** Find `### US-nnn` in `docs/USER-STORIES.md` and extract each acceptance criterion as its own numbered item (AC1, AC2, ...). Include criteria written in Given/When/Then form as one item each.
2. **Find the implementation.** Use the changed files if given, otherwise search `anchor-agentic/api/src`, `anchor-agentic/web/src`, and `anchor-agentic/supabase/migrations` for the behavior.
3. **Find the evidence for each criterion.** Evidence is one of:
   - a test that asserts the behavior (`file::test name`), and whether it was run and passed
   - code that clearly implements it (`file:line`)
   - a migration or RLS policy
4. **Judge each criterion:**
   - **Met**: implemented *and* covered by a test that was run, or implemented and obviously verifiable from the code
   - **Partially met**: some of the criterion is implemented or tested; say what is missing
   - **Not met**: no implementation found
   - **Not verifiable**: implemented but the only proof needs something unavailable (live Supabase credentials, a browser run); say which
5. **Check the invariants**, whatever the story is:
   - No server-side trust of client-supplied `owner_id`
   - Ownership enforced in both the API and RLS
   - Sandbox items remain readable by every registered user (no private mode)
   - Anonymous visitors see Published items only
6. **Never mark a criterion Met on the strength of a test you did not run or read.** Read the assertion; a test that exists but does not assert the criterion is not evidence.

## Output

```
## US-nnn <title>

| AC | Criterion (short) | Verdict | Evidence |
|---|---|---|---|
| AC1 | ... | Met | api/test/integration/roles.test.ts::<name> (passes) |
| AC2 | ... | Not met | no handler for ... |

## Invariants
- owner_id from JWT: ok / violated (<file:line>)
- ...

## Gaps
1. <what is missing and which AC it blocks>
```

State plainly when the story is done (all Met, or Met plus Not verifiable with the reason) and when it is not.
