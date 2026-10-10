---
paths:
  - "anchor-agentic/supabase/**"
---

# Supabase schema and migrations

- Schema changes are new numbered files in `migrations/` (`0024_<snake_case_topic>.sql`). Never edit an applied migration; add a follow-up.
- Open with a comment naming the story or architecture decision it implements, as existing migrations do.
- Every table gets `enable row level security` and explicit policies in the same change. Use the existing pattern:
  - `anon_read_published` (select to anon where `status = 'Published'`)
  - `authenticated_read_all` (select to authenticated using true; Sandbox is never private)
  - `owner_insert` / `owner_update` / `owner_delete` keyed on `owner_id = auth.uid()`
  - Child tables without `owner_id` (e.g. `agent_tasks`, `workflow_steps`) check ownership through the parent row.
- Owned entities carry `owner_id` (references `profiles`, on delete cascade), `status` (Draft, Published, UnderReview, Removed, Archived, Deprecated), `current_version`, `created_at`, `updated_at`.
- Add an index for the common access path (e.g. `(owner_id, status)`).
- Any new table or policy needs a matching suite in `anchor-agentic/api/test/rls/` that talks to Supabase directly, bypassing the Worker.
- Applying migrations to the linked cloud project is a shared, hard-to-reverse action: confirm with the user first.
