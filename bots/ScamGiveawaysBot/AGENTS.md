# ScamGiveawaysBot — project instructions

## Purpose and scope
ScamGiveawaysBot is a global Telegram scam-reporting bot. Reports are allegations and must pass administrator review before channel publication. The private report wizard, moderation actions, admin panel, channel configuration, and confirmed test-data reset are implemented in source.

## Platform and repository
- Repository: `abhijeetpatil2122/tg-cloud-sandbox`
- Project path: `bots/ScamGiveawaysBot/`
- Runtime: Telegram Serverless, CLI `@tgcloud/cli@0.2.0`
- Actions secret: `TGCLOUD_TOKEN_SCAMGIVEAWAYSBOT`
- App ID: read from the scoped CLI token; do not guess it.
- Deployment: manual-only until first intentional deployment and live Telegram tests are complete.

## Runtime rules
- Telegram Serverless handlers run in an isolated V8 runtime, not Node.js.
- Runtime imports are limited to documented `sdk` modules and this project's own relative modules. Relative imports must end in `.js`.
- Do not use Node built-ins, arbitrary npm packages, a persistent process, filesystem state, timers, or background workers in runtime modules.
- Handler files are directly under `tgcloud/handlers/`; the filename matches the Telegram update type.
- Use the built-in SQLite database and await every DB operation. New schema tables and columns require an explicitly approved migration before runtime use.
- Deploying `tgcloud/schema.js` does not apply migrations. Never run `npx tgcloud migrate` without separate explicit approval.

## Moderation and privacy
- Only administrator IDs `6522801911` and `1314643983` may access the admin panel and moderation callbacks.
- Reports are stored as `pending_review` and are not published until an authorized administrator approves them.
- Approval publishes to the channel stored in `bot_settings`; the bot must be an administrator with posting permission there.
- Declined reports are not published. Notify the reporter privately after either decision.
- Do not publish reporter identity or fetch submitted evidence URLs from the runtime.
- Keep a clear allegation/unverified disclaimer in public report posts. Do not automatically label an account as conclusively fraudulent.
- The `/resetdb` utility is temporary, admin-only, and confirmation-protected. It clears report data while preserving channel settings.

## Validation and deployment
- Run `npm ci` (or the lockfile-compatible install), then `node --check` for every changed runtime module.
- Use the repository's manual Telegram Serverless CLI workflow with `bots/ScamGiveawaysBot` and `FROM_TOKEN`; run `status` first.
- Deploy only when explicitly requested. Keep this project out of the auto-deploy registry.
- Never run `npx tgcloud migrate` without explicit approval. The updated handlers require the new `admin_sessions` and `bot_settings` tables and the new moderation columns on `scam_reports`.
- Read the root `/AGENTS.md` and `docs/tgcloud-sdk.md` before platform changes.
