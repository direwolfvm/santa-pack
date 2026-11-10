# Santa Pack: notes for agents

- **Merging to `main` deploys to production** (a Cloud Build trigger builds the root `Dockerfile`). Every PR must leave the app working.
- An overhaul is under way. Read [docs/overhaul-plan.md](docs/overhaul-plan.md) before larger changes, and update its phase status when you finish one.
- Follow the operator playbooks (github.com/direwolfvm/operator): `playbooks/ci-cd-and-deployment.md`, `playbooks/authentication.md`, `playbooks/dependabot.md`. The reference app is rosemont-club.
- Run `npm run check` before committing. Run `npm run test:e2e` when you touch `web/`.
- Code style: ESM, Node 22, JSDoc types checked by `tsc` (`strict`). Files marked `@ts-nocheck` are slated for replacement; don't add new ones.
- Never build DOM from user data with `innerHTML`. Use `textContent` / `createElement`.
- Gift secrecy (present names, givers) must be enforced on the server, never by hiding things in the browser.
- The live data is in the self-hosted Supabase "project-b" until the phase 5 migration. Read it only; don't write to it from scripts or tests.
- Key names only in code, docs and chat. Values live in Secret Manager.
