---
name: hono-endpoint-scaffold
description: Scaffold a new authenticated Hono API endpoint for an owned AnchorAgentic entity, with ownership check, error format, version snapshot, integration test, and OpenAPI entry, following roles.ts
---

# Hono Endpoint Scaffold

Creates a new endpoint (or router) in `anchor-agentic/api` that follows the conventions already used by `src/routes/roles.ts`. Prefer extending the existing router for the entity over adding a new file.

## Procedure

1. **Read the references** before writing anything: `src/routes/roles.ts`, `src/middleware/auth.ts`, `src/middleware/errorHandler.ts`, `src/lifecycle.ts`, `src/versioning.ts`, `src/app.ts` (where routers are mounted), and `.claude/rules/api-hono.md`.
2. **Confirm the story** in `docs/USER-STORIES.md` and its acceptance criteria. If there is none, stop and ask.
3. **Route skeleton** (no semicolons, 2-space indent, single quotes):
   - `new Hono<AppEnv>()` router, `router.use('*', requireAuth)` for non-public routes
   - an explicit column list constant, as `ROLE_COLUMNS` does, rather than `select('*')`
   - reads: `c.get('supabase')`, `.maybeSingle()`, `404` with `{ error: 'not_found', requestId }` when absent
   - creates: validate the body, force `owner_id` from `c.get('userId')`, insert, then `recordVersionSnapshot(...)`, respond `201`
   - updates/deletes: ownership pre-check (404 vs 403 with `logRejection`), then `validateStatusTransition` for status changes, then a version snapshot
   - errors: `{ error: '<snake_case_code>', requestId: c.get('requestId') }`; throw unexpected Supabase errors
4. **Mount the router** in `src/app.ts` under `/api/v1/...` if it is new.
5. **Extract pure logic** (validation, mapping) into a module in `src/` and unit test it.
6. **Tests:**
   - integration test in `test/integration/` using `testEnv.ts` (`chain`, `testEnv`) and the `vi.mock('../../src/supabase', ...)` pattern from `roles.test.ts`; cover 401, 400 validation, 404, 403 for a non-owner, and the happy path
   - an RLS suite if a new table or policy is involved (use the `rls-policy-test` skill)
7. **Update `openapi.yaml`** with the new path, request body, and responses.
8. **Verify:** `npm test` in `anchor-agentic/api`.

## Do not

- Accept `owner_id` from the request body.
- Skip the ownership pre-check because RLS exists; both layers are required.
- Introduce a private/hidden visibility option.
- Invent a new error shape.
