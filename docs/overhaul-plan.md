# Santa Pack overhaul plan

## Context

Santa Pack (santapack.me) is a family gift-exchange game: families run gift rounds that move through three stages, `giving` → `guessing` → `complete`. In each round, givers attach a real present plus a "cloaked" teaser name, receivers guess who gave each one, and the round ends in a reveal.

Earlier agents built it, and the evaluation turned up structural problems, not just stale code:

- **Secrets are only hidden in the browser.** Present names and givers are sent to receivers and hidden with CSS. They can also be read straight from Supabase with the public key.
- **Admins are exposed to stored XSS** (`innerHTML` with user-chosen names in `admin.html`).
- **Strangers see too much.** Anyone who signs up can see every family and every person.
- **Permission checks are inconsistent.** Managers are treated as global, and checks are split across browser → Supabase and browser → Express.
- **The live database is unclear.** It is probably self-hosted "project-b" on GCP, which operator wants to retire and reports as having no users.
- **Ops trail the operator standard:** single-stage root Dockerfile, an untracked Cloud Build trigger, no deploy config in the repo, and no lint, types or database tests.

**Decisions made:** follow the operator **rosemont-club pattern** for personal apps. That means:

- Firebase Auth on an Identity Platform tenant.
- **Firestore with deny-all client rules.**
- An Express API that verifies ID tokens with `firebase-admin` and enforces every rule.
- Vite + vanilla ES modules for the frontend, keeping the current look.
- Migrating any existing users and data off project-b, so it can be retired.

**Outcome:** a game whose secrets are enforced on the server, a stack and pipeline that match the operator playbooks, and a repo another agent can keep working on safely.

**About the reference:** rosemont-club is Next.js + TypeScript, not Express, so its patterns get ported rather than copied file for file. Where it falls short of operator's own rules (no emulator tests, no CSP or HSTS, email verification never enforced), this plan goes further, and each case is marked **(beyond rosemont)**.

## Target architecture

```
browser (Vite-built pages, Firebase Auth JS SDK)
   │  Authorization: Bearer <Firebase ID token>
   ▼
Express on Cloud Run  ── firebase-admin (ADC, runtime SA) ──► Firestore (rules: deny all)
   /api/*  JSON only, every route behind requireUser
   /api/health, /api/config (public Firebase web config + tenantId, as rosemont)
```

**Firestore model** (top-level collections, string ids):

| Collection                   | Fields                                                                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users/{uid}`                | `email`, `displayName`, `role: user\|admin`, `disabled`, `createdAt`. Only a seed CLI or an admin can change `role`.                                |
| `families/{id}`              | `name`, `joinCode` (random, so family names never need to be listed publicly), `createdAt`                                                          |
| `memberships/{familyId_uid}` | `familyId`, `uid`, `status: pending\|member`, `familyRole: member\|manager`. Replaces the global `manager` role, so managers are scoped per family. |
| `rounds/{id}`                | `familyId`, `name`, `stage`, `createdAt`                                                                                                            |
| `presents/{id}`              | `roundId`, `familyId`, `giverUid`, `receiverUid`, `name`, `description`, `cloakedName`, `guessUid`, `revealedAt`                                    |

**Visibility rules, enforced in one server module (`src/game/visibility.js`):**

| Stage    | Giver                                  | Receiver                                                                                                                            | Other members / managers | Site admin |
| -------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------- |
| giving   | Full details of the presents they give | Nothing (a count at most)                                                                                                           | Progress counts only     | Everything |
| guessing | Full details of the presents they give | `cloakedName` + own guess. `name`, `description` and giver come back only after that present is revealed, and revealing is one-way. | Guess progress only      | Everything |
| complete | Everything in the round                | Everything in the round                                                                                                             | Everything in the round  | Everything |

**Write rules:**

- Givers create or edit their own presents only during `giving`.
- Receivers set a guess only during `guessing`, and only before the reveal.
- Only managers of that family change the stage. Managers who are also players get no peek at present details (this is new: today managers see everything).

## Phases

The phases are ordered. Each one ends in its own PR on a branch in santa-pack. Phases 3 and 4 can run in parallel once phase 2 lands.

### Phase 0: Verify live state — done 2026-11-10

Findings, gathered read-only with `gcloud` and the project-b REST API:

- Cloud Run `santa-pack` (project `hopeful-machine-466912-t2`, us-east4) runs as the Compute default SA. `SUPABASE_URL` and `SUPABASE_ANON_KEY` come from Secret Manager secrets `SUPABASE_URL` and `SUPABASE_KEY`. `SUPABASE_URL` version 2 (2026-02-27) points at the **self-hosted project-b** stack.
- Deploys come from Cloud Build trigger `rmgpgab-santa-pack-us-east4-direwolfvm-santa-pack--mavkv`. On every push to `main` it builds the root `Dockerfile`, pushes `…/cloud-run-source-deploy/santa-pack/santa-pack:$COMMIT_SHA`, and runs `gcloud run services update`. **Every merge to `main` goes live**, so each phase must leave the app working.
- project-b holds real data: 4 auth users (all confirmed; one signed in 2026-11-10), 4 profiles (1 admin, 1 manager, 2 users), 3 families, 5 people, 4 gift rounds (1 complete, 1 guessing, 2 giving) and 12 presents. Operator's note "no users found for project-b" is wrong, so the phase 5 migration is required and project-b must stay up until then.
- Still to do: record this in operator `playbooks/authentication.md` and `inventory/gcp-personal.md`.

### Phase 1: Repo and tooling foundation — done (direwolfvm/santa-pack#106, deployed 2026-11-10)

Scoped so the live Supabase app keeps working (see the trigger above):

- Flatten `christmas-present-app/` to the repo root: `server/` (Express), `web/` (static pages), `tests/`, `supabase/`, `examples/`, `docs/`.
- Node 22, ESM (`"type": "module"`), `node --env-file-if-exists` in place of `dotenv`, and `node --watch` in place of `nodemon`.
- Routers are built from an injected Supabase client, so `createApp()` needs no environment and tests need no database. The server refuses to start without its config and exits cleanly on SIGTERM.
- ESLint (flat config), Prettier, and `tsc` with `checkJs` + `strict`. The Supabase controllers and the e2e SDK stubs are marked `@ts-nocheck` until phases 2 and 3 replace them. `innerHTML` in `web/` is a lint warning now and becomes an error in phase 3.
- Dockerfile: multi-stage `node:22-bookworm-slim`, prod deps only, `USER node`, `CMD node`. It stays at the root path the trigger builds.
- CI: lint, format, typecheck, unit tests, Playwright (it needs no secrets), dependency review, then the existing Docker build, gitleaks, audit and Dependabot auto-merge.
- Removed `.mcp.json`, which pointed at a Supabase Cloud project the app no longer uses. `EVALUATION.md` moved to `docs/evaluation-2026-08.md`.
- Deferred to phase 2 (where the replacement code lands): the Firebase layout (`firebase/`, `scripts/`, `tests/integration`) and removing the Supabase code and migration.

### Phase 2: Server on Firebase Admin — done (direwolfvm/santa-pack#108, deployed 2026-11-10)

**Why it sits alongside Supabase:** every merge to `main` deploys, and the current pages only speak Supabase. So the Firebase backend runs only when `BACKEND=firebase`. Production keeps the default (`supabase`) until the phase 5 cutover.

**Firebase layout:** santa-pack gets its own Identity Platform tenant (`santa-pack`) and its own Firestore database (`santa-pack`) in `hopeful-machine-466912-t2`. The `framblywish` app (wish.santapack.me) already uses that project, with its own tenant and database. This is operator's "one tenant per app in a shared project" pattern: users, data and rules stay separate, and no new project is needed. Nothing is created in GCP until phase 5.

**What was built:**

| File                       | What it does                                                                                                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/config.js`         | Validates the environment with zod for each backend. Missing settings are named without their values being printed.                                                                            |
| `server/firebase/admin.js` | Uses ADC, the named database and a tenant-scoped Auth. Uses the emulators when their env vars are set.                                                                                         |
| `server/firebase/auth.js`  | `requireUser` (Bearer token → `verifyIdToken(token, true)` → **verified email required** → `users/{uid}` created on first call → `disabled` is 403) and `requireAdmin`.                        |
| `server/game/rules.js`     | Pure functions: `projectPresent` (who sees which fields, by stage), `presentActionError` (edit, delete, guess, reveal), `canMoveStage` (one step at a time) and `roundProgress` (counts only). |
| `server/firebase/store.js` | Firestore access. Present updates and deletes, and stage changes, run in transactions that re-check the rules. Also holds the durable `rateLimits` and the `audit` log.                        |
| `server/firebase/api.js`   | The routes below. Non-members get 404, not 403, so family ids can't be probed.                                                                                                                 |
| `server/http.js`           | `HttpError`, zod errors → 400, and a generic 500.                                                                                                                                              |
| `server/security.js`       | helmet with a strict CSP and HSTS, plus the origin and JSON check for writes.                                                                                                                  |
| `server/firebase/app.js`   | `/api/health` and `/api/config` before auth. `no-store` on the API.                                                                                                                            |
| `firebase/firestore.rules` | Deny all.                                                                                                                                                                                      |
| `firebase.json`            | Emulator config.                                                                                                                                                                               |
| `scripts/seed-admin.mjs`   | Makes an existing account an admin by email. It's the only way to create one.                                                                                                                  |

**API** (all JSON, all behind sign-in). Phase 3 builds the pages on this:

| Route                                                                                                                                                       | Who                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `GET /api/me`, `PATCH /api/me {displayName}`                                                                                                                | Anyone signed in                               |
| `POST /api/families/join {code}` → pending                                                                                                                  | Anyone signed in (rate-limited to 10 per hour) |
| `GET /api/families/:id` → family, members, rounds (plus join code and pending list for managers)                                                            | Members                                        |
| `POST /api/families {name}`, `DELETE /api/families/:id`                                                                                                     | Admin                                          |
| `POST /api/families/:id/join-code` (rotate), `POST …/members/:uid/approve`, `PATCH …/members/:uid {familyRole}`                                             | Manager                                        |
| `DELETE …/members/:uid`                                                                                                                                     | Manager, or the person themselves              |
| `POST /api/families/:id/rounds {name}`, `PATCH /api/rounds/:id {stage}`                                                                                     | Manager                                        |
| `DELETE /api/rounds/:id`                                                                                                                                    | Admin                                          |
| `GET /api/rounds/:id` → round, members, projected presents, progress                                                                                        | Members                                        |
| `POST /api/rounds/:id/presents`, `PATCH /api/presents/:id` (giving stage), `DELETE /api/presents/:id` (giving stage; admins any time)                       | Giver                                          |
| `PUT /api/presents/:id/guess {guessUid}`, `POST /api/presents/:id/reveal` (guessing stage; reveal is one-way)                                               | Receiver                                       |
| `GET /api/admin/users`, `PATCH /api/admin/users/:uid {role, disabled}`, `GET /api/admin/families`, `POST /api/admin/families/:id/members {uid, familyRole}` | Admin                                          |

**Tests:**

- `tests/unit/rules.test.js` and `config.test.js`: table-driven, no emulator.
- `tests/integration/*.test.js`, run with `npm run test:integration` (emulators, `demo-santa-pack`, a fresh tenant per file). They cover:
  - 401 for a missing or forged token; 403 for an unverified email, a disabled account, the wrong role, the wrong stage, or a write from another origin; 415 for a non-JSON write.
  - Non-members get 404.
  - Secrecy: the receiver's and manager's responses never contain the present name or description.
  - Deny-all Firestore rules, checked against an emulator admin-token control.
- CI runs them in a new `integration` job on Java 21.

**Not done here:** the old Supabase code and migration are still present. They go at cutover, in phase 5.

### Phase 3: Frontend on Vite — this PR

**Lives beside the old pages:** `app/` is a new Vite multi-page app built to `dist/`. The server serves it only when `BACKEND=firebase`. Production (`BACKEND=supabase`) keeps serving `web/` unchanged until the phase 5 cutover.

**Seven pages in place of fifteen.** The old per-stage pages (`giftRounds`, `people`, `person`, `presents`, `guesses`, the three `summary-*` pages, `manageFamily`, `createPerson`, `reset-password`) fold into:

| Page           | What's on it                                                                                                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `login.html`   | Sign in, sign up (name + email verification), and a reset email that gives the same message whether or not the account exists.                                                                                             |
| `verify.html`  | Waits for the email link, then refreshes the token so the server sees `email_verified`.                                                                                                                                    |
| `index.html`   | Your families, pending requests, and joining by code.                                                                                                                                                                      |
| `family.html`  | Rounds and members. For managers: the join code, approvals, roles, removals and new rounds. Anyone can leave.                                                                                                              |
| `round.html`   | One page for every stage, rendered from what the server sends: giving (your gifts, add and edit), guessing (cloaked cards, guess, unwrap), complete (every gift plus the best guessers). Managers also get stage controls. |
| `profile.html` | Display name, and a password reset email.                                                                                                                                                                                  |
| `admin.html`   | Families (create, delete, join codes, add someone directly) and accounts (admin role, turn off).                                                                                                                           |

**Shared modules** in `app/src/lib/`:

- `firebase.js`: web config from `/api/config`, tenant ID, and the Auth emulator when the server says so.
- `api.js`: adds the ID token and turns errors into messages people can read.
- `dom.js`: an `h()` builder that only ever sets `textContent`, plus `safeNextPath`.
- `ui.js`: a `<dialog>` confirm, a live-region toast, busy buttons, tables.
- `shell.js`: the page frame and navigation, plus a sign-in guard.

**Rules this enforces:**

- Lint makes `innerHTML`, `outerHTML` and `insertAdjacentHTML` an error in `app/`.
- No CDN scripts. The Firebase SDK is bundled (29 KB gzipped).
- The server's CSP (`script-src 'self'`) holds with no violations; the e2e test checks the console.

**Secrecy fix found while building this.** The phase 2 round progress showed per-person giving and receiving counts, which pair givers with receivers in small families. `roundProgress` now returns:

- while giving: each person's number of gifts wrapped;
- while guessing: round totals only;
- once complete: everything.

The unit and integration tests assert this.

**Tests:** `tests/e2e-firebase/game.spec.js` (run with `npm run test:e2e:firebase`, which uses the emulators and a fixed `santa-e2e` tenant) covers:

- sign-up → verify → home, on desktop and mobile;
- the wrong-password message;
- a whole round with four people: admin creates the family → join by code → approval → manager role → round → gift → guessing → guess → unwrap → reveal.

While guessing, the test records every API response the receiver's browser gets and asserts none contains the gift name. As a control, the same watcher must then see it after unwrapping. CI runs this in the emulator job.

**Emulator ports:** 9399 (Auth) and 8389 (Firestore), so they don't collide with other projects' emulators on the default ports.

### Phase 4: Tests and CI (after phase 2; can run alongside phase 3)

- **Unit tests** (`node --test`): `visibility.js` and the stage and permission matrix, written table-driven.
- **(beyond rosemont, which has no emulator tests)** Integration tests against the Firebase Emulator Suite (`firebase emulators:exec`, `firebase-tools` as a dev dependency):
  - Every route gets 401 for no token, 401 for a forged token, 403 for the wrong family or role, and 403 for the wrong stage.
  - Secrecy cases: the receiver never gets `name`, giver or `description` before a reveal, and managers get no peek.
  - A rules test proving clients are denied all Firestore access.
- **Live smoke test** `scripts/smoke.mjs`, ported from rosemont `scripts/smoke.ts`. Run by hand after deploy, it:
  - creates `santa-pack-test-*` users and gets tokens through REST `signInWithPassword` with `tenantId`;
  - checks the 401 and 403 cases, a disabled user, and that a direct Firestore REST read is denied;
  - removes its fixtures afterwards.
- **Playwright** on the built app against the emulators: sign up → join → approve → give → guess → reveal → complete, on desktop and mobile. Keep the existing a11y and viewport checks.
- **`ci.yml`** extends the current hardened workflow. Jobs:
  - lint
  - typecheck
  - unit
  - integration (Java + `firebase-tools` emulators)
  - e2e
  - build
  - `npm audit`
  - `dependency-review-action`
  - Docker build plus a Trivy image scan
  - gitleaks
  - Dependabot auto-merge job
- Keep `codeql.yml`. Dependabot config stays as is, with the npm directory updated to `/`.

### Phase 5: Firebase project, data migration, deploy (needs your GCP and Firebase access)

- **Infra, one time**, not run by CI:
  - Port rosemont `scripts/provision.py`: it is idempotent, finds the web app config, adds authorized domains, grants the runtime SA `datastore.user` (conditioned on the `santa-pack` database), `firebaseauth.viewer` and `identityplatform.viewer`, and writes `.env.local` and `deploy-env.yaml`.
  - Port `scripts/deploy-rules.py`, which publishes the rules through the Rules REST API.
  - Document the WIF and deployer setup in `docs/CI-CD.md`, following rosemont's.
  - The pieces it sets up:
  - Identity Platform tenant `santa-pack` in the shared Firebase project rosemont uses (or its own project, if operator's open question on project naming says so).
  - Email/password with verification. Authorized domain santapack.me. Optional Google provider.
  - Firestore database. `santa-pack-deployer` and `santa-pack-runtime` service accounts, with the deployer bound to the GitHub WIF provider for this repo only.
  - Secrets in Secret Manager as `SANTA_PACK_*`, if any are needed. The Firebase web config is public, so it goes in `deploy-env.yaml`.
  - Decide whether to move the service out of the misleadingly named `hopeful-machine-466912-t2` into `permitting-ai-helper`, following the operator playbook.
- **Migration script** `scripts/migrate-from-supabase.mjs`. It is a dry run by default and runs from the laptop with a project-b database URL that is never committed:
  - Exports `auth.users` with bcrypt hashes and imports them with `admin.auth().importUsers(..., { hash: { algorithm: 'BCRYPT' } })`, keeping the same passwords and marking email verified where Supabase had confirmed it.
  - Maps `profiles.role` admin → `users.role`, and manager → `familyRole: manager` on their memberships.
  - Copies families, people (→ memberships), rounds and presents, rewriting ids to uids.
  - Prints counts before and after. If phase 0 finds no users, skip it.
- **Deploy**, copied from rosemont-club:
  - `.github/workflows/deploy.yml`: on push to `main` and `workflow_dispatch`, in a `production` environment limited to `main`. It re-runs tests, authenticates with WIF, runs `gcloud builds submit` with `cloudbuild.yaml`, and tags the image with `$BUILD_ID`.
  - Cloud Run settings: runtime SA, `deploy-env.yaml`, a startup probe on `/api/health`, and explicit instances, memory and concurrency.
  - A post-deploy curl of `https://santapack.me/api/health`.
  - Cloud Run flags as rosemont's `cloudbuild.yaml`: `--min-instances=0 --max-instances=3 --memory=512Mi --concurrency=40 --timeout=60`, the startup probe on `/api/health`, and `--gcs-source-staging-dir`.
  - The post-deploy check reads `latestReadyRevisionName`, then curls the health URL with 12 retries.
  - Deploy `firestore.rules` as an explicit step with `deploy-rules.py`.
- **Dockerfile**: multi-stage `node:22-bookworm-slim`. The build stage runs `vite build`. The runtime stage has prod deps only, `USER node`, and `CMD ["node","server/index.js"]`.
- **Cutover:**
  - Freeze writes (a short banner), then run the migration.
  - Deploy, smoke-test sign-in with a migrated account, and delete the old Cloud Build trigger.
  - Update operator's inventory and authentication playbook rows for santa-pack, and mark project-b free to retire if nothing else uses it.

## Critical files

| Status    | Files                                                                                                                                                                                                                                                                                                                                          |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New       | `server/{index,app,firebase,auth}.js`, `server/routes/*.js`, `server/game/{visibility,families,rounds,presents}.js`, `web/` (Vite pages and `src/lib/*`), `firebase/firestore.rules`, `scripts/{seed-admin,migrate-from-supabase}.mjs`, `.github/workflows/deploy.yml`, `cloudbuild.yaml`, `deploy-env.yaml`, `docs/gcp-setup.md`, `CLAUDE.md` |
| Rewritten | `Dockerfile`, `README.md`, `.github/workflows/ci.yml`, `package.json`                                                                                                                                                                                                                                                                          |
| Removed   | `christmas-present-app/src/db/supabaseClient.js`, `src/lib/request.js`, `src/controllers/*`, `supabase/migrations/*`, `.mcp.json`, `docker-compose.yml` (replaced by `npm run dev` with the emulators)                                                                                                                                         |
| Reused    | `src/public/styles.css`, `snow.js`, `santa-hat.svg`, the page markup and copy, `layout.js`/`nav.js` (ported to modules), the existing Playwright a11y and viewport tests, `ci.yml` hardening (SHA pins, permissions, concurrency, gitleaks, auto-merge), `dependabot.yml`                                                                      |

## Verification

- `npm run lint && npm run typecheck && npm test` pass locally.
- `npm run test:integration` passes against the emulators, including the whole 401/403/stage/secrecy matrix.
- `npm run test:e2e` runs the full game flow on desktop and mobile.
- Manual check in the browser pane against the emulators:
  - The receiver's network tab never shows `name` or giver before a reveal.
  - A name like `<img src=x onerror=alert(1)>` renders as text on the admin page.
  - A stranger who signs up sees no families.
- CI is green on each PR. After deploy, the workflow's health check passes and a migrated user can sign in at santapack.me with their old password.
