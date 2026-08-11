# Santa Pack application

A small Express and Supabase application for family gift exchanges. The browser UI is intentionally framework-free: shared layout, navigation, and styling enhance a set of focused HTML workflows.

## Requirements

- Node.js 20 or newer
- A Supabase project with the Santa Pack tables and row-level-security policies

## Setup

```sh
cp .env.example .env
npm install
npm run dev
```

Set these values in `.env`:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
PORT=8080
```

Never use a Supabase service-role key in the browser or commit it to the repository.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the app with automatic restarts |
| `npm start` | Start the production server |
| `npm test` | Run fast unit and server integration tests |
| `npm run test:e2e` | Run desktop and mobile browser tests |
| `npm run test:all` | Run both suites |

Playwright starts its own test server with safe placeholder Supabase values. Browser traces and failure screenshots are written to `output/playwright/` and ignored by Git.

## Example data

[`examples/sample-data.json`](./examples/sample-data.json) contains two festive sample households, six people, three rounds in different stages, and several cloaked presents. It is designed as a readable fixture and a source for seed scripts without embedding real account IDs or credentials.

## Database baseline

[`supabase/migrations/20260811000000_baseline.sql`](./supabase/migrations/20260811000000_baseline.sql) documents the inferred application schema, indexes, constraints, signup trigger, and row-level-security policies for a new installation.

For an existing hosted project, do not apply the baseline blindly. Link the Supabase CLI to a development project, compare the live schema with `supabase db diff`, review the generated changes, and test them against a disposable database first. The repository does not contain credentials or proof that the production schema exactly matches this reconstructed baseline.

API calls automatically forward the signed-in browser token. Server-side Supabase queries use a request-scoped client so database policies see the correct `auth.uid()`.

## Architecture

- `src/app.js` creates and configures the Express application.
- `src/index.js` is the production entry point.
- `src/controllers/` contains API behavior.
- `src/lib/request.js` centralizes bearer-token parsing and input validation.
- `supabase/migrations/` contains the versioned database baseline and security policies.
- `src/public/` contains the browser workflows and shared Christmas design system.
- `tests/unit/` covers server and authorization seams.
- `tests/e2e/` covers responsive and keyboard-critical browser behavior.

The `/api/health` endpoint is available for container health checks. The server disables the `X-Powered-By` response header and limits request bodies to 100 KB.
