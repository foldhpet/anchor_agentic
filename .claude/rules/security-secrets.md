# Secrets and credentials

- Never print, paste, log, or commit Supabase secrets: URL, anon key, service role key, DB password, access tokens, GitHub tokens, or `RLS_TEST_USER_*` passwords.
- Credentials come from `supabase login` / `supabase link` (run by the user) or from the gitignored `anchor-agentic/api/.dev.vars` and `anchor-agentic/web/.env`. Do not read these files; if configuration is missing, point the user at `.dev.vars.example` / `.env.example` and ask them to fill it in.
- Add new config keys to the `*.example` file with a placeholder value, never a real one.
- Never use the service role key where a per-request user client works; `requireAuth` builds the request-scoped client for a reason.
- Test accounts use a real MX-valid domain (e.g. `mailinator.com`); Supabase Auth rejects `@example.com`.
