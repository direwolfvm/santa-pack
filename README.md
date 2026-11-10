# Santa Pack

A family gift-exchange game at [santapack.me](https://santapack.me). Families run gift rounds in three stages:

1. **Giving**: each person picks presents for others and gives each one a "cloaked" teaser name.
2. **Guessing**: receivers see only the teaser and guess who gave it.
3. **Complete**: everything is revealed.

> **Overhaul in progress.** The app is moving from Supabase to Firebase Auth + Firestore with a server-enforced API, following the operator playbooks. See [docs/overhaul-plan.md](docs/overhaul-plan.md) for the phases and what is done. This README describes the code as it is today.

## Architecture (today)

| Path                               | What it is                                                                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/`                          | Express 5 API (`/api/families`, `/api/presents`, `/api/health`) and static file server. `index.js` reads config and starts the app; `app.js` builds it from injected routers.                                                   |
| `web/`                             | Static HTML pages with classic scripts. The browser signs in with Supabase Auth and calls the API with its access token (`web/api.js`).                                                                                         |
| `supabase/migrations/`             | A schema and RLS baseline reconstructed from the code. It was **never reconciled** with the live database.                                                                                                                      |
| `server/firebase/`, `server/game/` | The new backend, used when `BACKEND=firebase`: Firebase Auth tokens verified on the server, Firestore behind deny-all rules (`firebase/firestore.rules`), and the game's secrecy rules in `server/game/rules.js`. Not live yet. |
| `tests/unit/`                      | `node:test` + supertest.                                                                                                                                                                                                        |
| `tests/integration/`               | The Firebase API against the Auth and Firestore emulators (needs Java 21).                                                                                                                                                      |
| `tests/e2e/`                       | Playwright (desktop and mobile Chromium) with the Supabase SDK stubbed, so it needs no backend.                                                                                                                                 |

## Local development

Requires Node 22.9 or newer.

```sh
cp .env.example .env   # fill in SUPABASE_URL and SUPABASE_ANON_KEY
npm install
npm run dev            # http://localhost:8080, restarts on change
```

## Checks

```sh
npm run check          # lint, format check, typecheck, unit tests
npm run test:integration  # Firebase API against the emulators (Java 21)
npm run test:e2e       # Playwright; run `npx playwright install chromium` once first
npm run format         # apply Prettier
```

CI (`.github/workflows/ci.yml`) runs all of the above plus `npm audit`, dependency review, a Docker build and gitleaks on every pull request. CodeQL runs separately.

## Deploy

- **Live target:** Cloud Run service `santa-pack` in GCP project `hopeful-machine-466912-t2`, region `us-east4`, behind santapack.me.
- **How:** a Cloud Build trigger builds the root `Dockerfile` on every push to `main` and updates the service. **Merging to `main` deploys.**
- **Config:** `SUPABASE_URL` and `SUPABASE_ANON_KEY` come from the Secret Manager secrets `SUPABASE_URL` and `SUPABASE_KEY`.
- **Health:** `GET /api/health`.

Phase 5 of the overhaul replaces the trigger with a GitHub Actions deploy (Workload Identity Federation → Cloud Build → Cloud Run, health-checked), following the rosemont-club pattern.

## Docker

```sh
cp .env.example .env
docker compose up --build
```
