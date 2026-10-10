---
paths:
  - "anchor-agentic/**"
---

# Layer boundaries

| Layer | Owns | Must not |
|---|---|---|
| `web` (SvelteKit) | UI, forms, server-side load/actions | Call Supabase for anything the API exposes; hold business rules |
| `api` (Hono on Workers) | Business logic, validation, authorization, ownership checks | Trust a client-supplied `owner_id` |
| `supabase` | Schema, migrations, RLS | Be the *only* enforcement layer |

- Ownership and authorization are enforced in the API **and** in RLS. Both layers are intentionally redundant and each has its own tests. Never remove one because the other exists.
- Sandbox items are never private. Do not add a private/hidden mode, flag, or policy. Registered users read everything; anonymous visitors read Published only; only the owner writes.
- Ground feature work in `docs/USER-STORIES.md`: find or add the story and acceptance criteria before writing code, and re-check the criteria before calling it done.
- Role and Task are metadata on export. Only Agent, Skill and Workflow map to real Claude Code files (`docs/ARCHITECTURE.md`, Decision 1).
