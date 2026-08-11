# Codebase evaluation

## What this refresh addressed

- Replaced the runtime-loaded US Web Design System with a purpose-built Santa Pack visual system. This removes a UI dependency, gives the product a distinctive voice, and improves mobile tables, focus states, reduced-motion behavior, and empty states.
- Reworked the family and gift-round landing workflows into scannable cards with human-readable counts, stage badges, readiness cues, and action labels.
- Split Express app construction from process startup so the server can be tested without binding a port.
- Updated production dependencies, removed obsolete proxy/fetch/body-parser packages, moved Docker to a supported Node release, and eliminated known production dependency vulnerabilities.
- Added consistent bearer-token checks to present writes and destructive family operations. Fixed authorization comparisons that mixed Supabase profile UUIDs with numeric person IDs.
- Added name and gift-round-stage validation, request-size limits, a health endpoint, example data, unit/integration coverage, and desktop/mobile end-to-end coverage.

## Highest-priority follow-ups

1. **Database migrations and policies.** The repository still does not contain the authoritative Supabase schema or RLS policies. Export those into versioned migrations, test them locally, and make server checks mirror the policies.
2. **Family-scoped organizer authorization.** Managers currently receive broad manager capability in a few controller paths. Add a single authorization service that verifies the manager belongs to the target family for every mutation.
3. **Frontend modules.** Several pages still contain large inline scripts. Move the remaining workflows into page modules and centralize authenticated fetch, error messages, confirmation dialogs, and loading states.
4. **API contract tests.** Expand the Supabase test double or run a local Supabase stack to cover happy paths, family boundaries, role escalation, and all create/update/delete routes.
5. **Content security policy.** Self-host the font and Supabase browser client, then add a strict CSP. The current UI still loads those assets from trusted CDNs.
6. **Accessible confirmation and announcements.** Replace `alert`/`prompt` usage with accessible dialogs and add live-region feedback for async saves, approvals, and stage changes.

## Design direction

The visual language is intentionally “heirloom wrapping paper meets community Christmas party”: evergreen and berry tones, gold ornament details, candy-cane edging, chunky editorial headings, paper textures, and restrained snow. Product copy is warm and playful, while controls and status language remain direct.
