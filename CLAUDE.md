# Santa Pack: notes for agents

- **Merging to `main` deploys to production** through `.github/workflows/deploy.yml` (keyless GitHub OIDC → Cloud Build → Cloud Run, health-checked). Every PR must leave the app working. The old Cloud Build trigger is disabled.
- An overhaul is under way. Read [docs/overhaul-plan.md](docs/overhaul-plan.md) before larger changes, and update its phase status when you finish one.
- Follow the operator playbooks (github.com/direwolfvm/operator): `playbooks/ci-cd-and-deployment.md`, `playbooks/authentication.md`, `playbooks/dependabot.md`. The reference app is rosemont-club.
- Run `npm run check` before committing. Run `npm run test:integration` when you touch `server/firebase/` or `server/game/`, `npm run test:e2e` when you touch `web/`, and `npm run test:e2e:firebase` when you touch `app/`.
- Production runs the Firebase app (`BACKEND=firebase`, set in `deploy-env.yaml`) and serves `app/` (Vite). `web/` and the Supabase server code are legacy, kept for rollback until the cleanup in docs/cutover.md step 7. Don't change them.
- Code style: ESM, Node 22, JSDoc types checked by `tsc` (`strict`). Files marked `@ts-nocheck` are slated for replacement; don't add new ones.
- Never build DOM from user data with `innerHTML`. In `app/`, use `h()` from `app/src/lib/dom.js` (lint enforces this).
- Gift secrecy (present names, givers) must be enforced on the server, never by hiding things in the browser. Every present read goes through `projectPresent` and every write through `presentActionError` (`server/game/rules.js`).
- Live data is in Firebase: tenant `santa-pack-y6e8u`, Firestore database `santa-pack`. Never point tests or scripts at it; use the emulators. The self-hosted Supabase "project-b" holds the pre-cutover copy. Read it only.
- Key names only in code, docs and chat. Values live in Secret Manager.
