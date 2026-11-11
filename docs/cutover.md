# Cutover: Supabase → Firebase

The runbook for switching santapack.me from the Supabase app (`BACKEND=supabase`, `web/`) to the Firebase app (`BACKEND=firebase`, `app/`). Phase 5 of [overhaul-plan.md](overhaul-plan.md).

## Already in place (2026-11-10)

All in `hopeful-machine-466912-t2`. None of these are used by the live site yet.

| Piece                    | Name                                                                                                                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identity Platform tenant | `santa-pack-y6e8u` (email/password). `santapack.me` is an authorized domain.                                                                                                                                                                                                   |
| Firebase web app         | "Santa Pack", `1:983969754780:web:d3ee90526de5e8a6e24759` (uses the project's shared browser key)                                                                                                                                                                              |
| Firestore database       | `santa-pack`, us-east4, delete protection on. Deny-all rules published with `node scripts/deploy-rules.mjs --apply`.                                                                                                                                                           |
| Runtime service account  | `santa-pack-runtime`: `datastore.user` on the `santa-pack` database only, `firebaseauth.viewer`, and `identityplatform.viewer` **on the tenant**. The token revocation check needs that last one: without it every sign-in gets 401, logged as `auth/insufficient-permission`. |
| Deployer service account | `santa-pack-deployer`: Cloud Build editor, `run.viewer`, `serviceUsageConsumer`, and actAs on the Compute SA. It can write to the build bucket.                                                                                                                                |
| GitHub OIDC              | Provider `santa-pack` in pool `github`. It trusts `direwolfvm/santa-pack` only and is bound to `santa-pack-deployer`.                                                                                                                                                          |
| Data                     | Rehearsal migration done: 4 accounts (with their passwords), 3 families, 5 memberships (2 guests), 4 rounds, 12 presents                                                                                                                                                       |

## Rehearsal

`santa-pack-preview` (https://santa-pack-preview-jll5e6reca-uk.a.run.app) runs Firebase mode on the migrated data with the runtime SA. It's a separate service, so the live service's template can't change. It was checked with a throwaway account that was then deleted:

- sign-in works, and admin routes give a plain user 403;
- all 3 families and 4 rounds load with the right stages;
- the 2 guests appear;
- all 12 presents are there.

Two problems it found, now fixed:

- the missing tenant role;
- `--allow-unauthenticated` makes Cloud Run reject Firebase ID tokens, so `cloudbuild.yaml` uses `--no-invoker-iam-check`, like the live service.

## Steps

Each step says how to undo it.

1. **Announce a short freeze.** The Supabase app keeps working, but anything changed after step 2 won't carry over.
2. **Final migration.** Start `cloud-sql-proxy permitting-ai-helper:us-east4:metabase-sql --port 55432`, then run `node scripts/migrate-from-supabase.mjs` (a dry run), then add `--apply`. The connection URL comes from the `project-b-db-url-default` secret.
   - Undo: nothing to undo. It writes only to the new tenant and database, overwriting the rehearsal documents.
3. **Make the first admin.** Run `node scripts/seed-admin.mjs <email>`, or rely on the migrated admin role.
4. **Turn on the new deploy:**
   - Create the `production` GitHub environment, limited to `main`.
   - Set the repository variable `DEPLOY_ENABLED=true`.
   - Disable the old trigger: `gcloud builds triggers update rmgpgab-santa-pack-us-east4-direwolfvm-santa-pack--mavkv --disabled --region global`.
   - Undo: set `DEPLOY_ENABLED=false` and re-enable the trigger.
5. **Deploy.** Run the Deploy workflow (`workflow_dispatch`). It builds, deploys with `deploy-env.yaml` (`BACKEND=firebase`, runtime SA, no secrets) and health-checks santapack.me.
   - Undo, within seconds: `gcloud run services update-traffic santa-pack --to-revisions=<last supabase revision>=100 --region us-east4`. The previous revision still has its Supabase settings.
6. **Smoke test on santapack.me:**
   - A migrated user signs in with their existing password.
   - Families and rounds show up.
   - A manager sees the guests under "Playing as".
7. **After a quiet week:**
   - Remove `web/`, `server/app.js`, `server/routes/`, `server/controllers/`, `server/db/`, `server/lib/request.js`, `supabase/`, `@supabase/supabase-js`, and the `BACKEND=supabase` path. Make `firebase` the only backend.
   - Delete the `santa-pack-preview` service and the Supabase secrets `SUPABASE_URL` / `SUPABASE_KEY`.
   - Mark project-b free to retire in operator (`playbooks/authentication.md`, `inventory/gcp-personal.md`).
