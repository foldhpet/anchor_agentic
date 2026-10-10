---
paths:
  - "anchor-agentic/api/**"
---

# API (Hono on Cloudflare Workers)

Match the existing code (`src/routes/roles.ts` is the reference):

- Style: no semicolons, 2-space indent, single quotes.
- One router per resource in `src/routes/`, typed `new Hono<AppEnv>()`. Authenticated routers call `router.use('*', requireAuth)` so undefined sub-paths also 401.
- Take the Supabase client and user from context (`c.get('supabase')`, `c.get('userId')`). Force `owner_id` from the verified JWT, never from the request body.
- Writes: run the ownership pre-check (404 when missing, 403 + `logRejection(c, 403, ...)` when not owner), validate the body, then record a version snapshot via `recordVersionSnapshot` and respect `validateStatusTransition` from `lifecycle.ts`.
- Errors: respond `{ error: '<snake_case_code>', requestId: c.get('requestId') }` with the right status. Throw unexpected Supabase errors so `errorHandler` handles them.
- Comment the story or decision a non-obvious rule comes from (`US-005`, `Architecture Decision 6`), as the existing routes do.
- Keep pure logic (validation, mapping, lifecycle) in its own module under `src/` so it gets a unit test.
- Update `openapi.yaml` when an endpoint is added or changed.

Every new or changed endpoint needs:
1. an integration test in `test/integration/`,
2. a unit test for any extracted pure logic in `test/unit/`,
3. an RLS test in `test/rls/` when it touches a new table or policy.

Run `npm test` (vitest run) from `anchor-agentic/api` before declaring done.
