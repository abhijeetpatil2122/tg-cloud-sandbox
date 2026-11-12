# ScamGiveawaysBot — project instructions

## Purpose and scope
ScamGiveawaysBot is a Telegram scam-reporting project. The minimal private report wizard is implemented in source. Public publishing, moderator review, evidence verification, and correction/appeal flows remain out of scope until separately designed.

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
- A handler receives its update payload as the first argument and context as the second; the full update is available as `ctx.update`.
- Use the built-in SQLite database for persistent drafts and submissions. Await every DB operation. New schema tables require an explicitly approved migration before runtime use.
- Deploying `tgcloud/schema.js` does not apply migrations. Never run `npx tgcloud migrate` without separate explicit approval.

## Safety and privacy requirements
- Treat submitted links, usernames, phone numbers, wallet addresses, screenshots, and files as untrusted user-provided evidence.
- Do not automatically label a person or account a scammer based only on an unverified user report.
- Design reports as allegations with evidence and status (for example: pending review, confirmed, rejected, or disputed), and provide an appeal/correction path before public exposure.
- Minimize retained personal data. Do not publish reporter identity or private evidence without a clear policy and explicit consent.
- Prevent duplicate/spam submissions and abuse of reporting endpoints; add moderation and auditability before public-facing claims.
- Never fetch or open submitted URLs from the bot runtime without a separately reviewed safe-fetch design. Avoid SSRF, credential leaks, and malware execution.
- Never commit bot tokens, Serverless CLI credentials, `.tgcloud/`, `node_modules/`, or local `.env` files.

## Validation and deployment
- Run `npm ci` (or the lockfile-compatible install), then `node --check` for every changed runtime module.
- Use the repository's manual Telegram Serverless CLI workflow with `bots/ScamGiveawaysBot` and `FROM_TOKEN`; run `status` first.
- Deploy only when explicitly requested. Keep this project out of the auto-deploy registry until its first deployment and live tests are verified.
- Never run `npx tgcloud migrate` without explicit approval. The report wizard requires the `report_drafts` and `scam_reports` tables to exist before it can run.
- Read the root `/AGENTS.md` and `docs/tgcloud-sdk.md` before platform changes.
