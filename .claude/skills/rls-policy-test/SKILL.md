---
name: rls-policy-test
description: Generate an RLS test suite for a Supabase table or policy that talks to Supabase directly, bypassing the Hono Worker, to prove Row-Level Security independently
---

# RLS Policy Test

Row-Level Security is the second, independent enforcement layer behind the API's own checks (Architecture Decision 6). These tests must pass or fail on the policies alone, so they use supabase-js directly and never import the Hono app.

## When to use

- A migration adds a table or changes a policy
- A story adds an owned entity or changes who can read or write it

## Procedure

1. **Read the migration** that defines the table and its policies (see `anchor-agentic/supabase/migrations/0012_rls_policies_epic_b.sql` for the standard set). List every policy: `anon_read_published`, `authenticated_read_all`, `owner_insert`, `owner_update`, `owner_delete`, plus any child-table or moderator policies.
2. **Copy the pattern** from the closest existing suite in `anchor-agentic/api/test/rls/` (`roles.rls.test.ts` is the reference), including its `canRun` guard and `describe.skipIf(!canRun)`, so the suite skips cleanly when credentials are absent.
3. **Write one test per behavior**, using users A and B (`RLS_TEST_USER_A_*`, `RLS_TEST_USER_B_*`) and an anon client:

   | Behavior | Expectation |
   |---|---|
   | Owner inserts with own `owner_id` | succeeds |
   | Insert with another user's `owner_id` | rejected |
   | Non-owner updates or deletes the row | blocked (zero rows affected or an error; assert what Supabase actually returns) |
   | Owner updates and deletes | succeeds |
   | Another authenticated user reads a Draft row | allowed (Sandbox is never private) |
   | Anon reads a Draft row | not returned |
   | Anon reads a Published row | returned |
   | Child table write when the parent belongs to someone else | blocked |

4. **Clean up** every row the test creates, using the owner's client, so reruns stay deterministic. Give probe rows a recognizable name such as `RLS probe ...`.
5. **Run** `npx vitest run test/rls/<file>` in `anchor-agentic/api`. Without the credentials the suite will skip; report that explicitly instead of calling it passed.

## Rules

- Never import `createApp` or anything from `src/routes` in an RLS test.
- Never read or print real credentials; take them from `env` only, as the existing suites do.
- Use users on a real MX-valid domain (mailinator.com).
- Assert on what RLS does, not on the API's error format.
- Do not add a test that expects a Draft row to be hidden from other authenticated users; that contradicts the product design.
