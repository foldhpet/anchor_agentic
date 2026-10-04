# AnchorAgentic.io

A free, community-driven platform where individuals define Roles, Tasks, Agents, Skills, and Workflows for agentic software development — starting from proven templates, refining them in a personal Sandbox, and publishing the best work to a public Marketplace.

See `CLAUDE.md` for the project overview and `docs/` for the product concept, architecture, and user stories.

`generator/` and `example-taf/` are earlier work exploring a Flow Model test-automation generator; they are legacy/reference material and not part of AnchorAgentic.io.

## Running locally

The API and web app are self-contained npm projects — install each one's dependencies before running it:

```
cd anchor-agentic/api && npm install
cd anchor-agentic/web && npm install
```

Each also needs its own local config (gitignored, not checked in) copied from its example file and filled in — see `api/.dev.vars.example` and `web/.env.example`. Credentials come from `supabase login`/`supabase link`, never pasted into chat.

### 1. Start the backend (API)

```
cd anchor-agentic/api
cp .dev.vars.example .dev.vars   # first time only — then fill in the Supabase values
npm run dev
```

This starts the Hono API on Cloudflare Workers (via `wrangler dev`) at **http://localhost:8787**.

### 2. Start the frontend (web)

In a separate terminal:

```
cd anchor-agentic/web
cp .env.example .env   # first time only — then fill in the Supabase values
npm run dev
```

This starts the SvelteKit dev server (via `vite dev`) at **http://localhost:5173**, already configured (`PUBLIC_API_URL`) to talk to the API above.

### 3. Open it in a browser

With both servers running, open **http://localhost:5173** in your browser. The Marketplace is browsable anonymously; registering/logging in unlocks My Sandbox and All Sandbox.
