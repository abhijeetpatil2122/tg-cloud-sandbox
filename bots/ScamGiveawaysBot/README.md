# ScamGiveawaysBot

A Telegram bot project for collecting and reviewing reports about suspected scams, fake giveaways, impersonation, phishing, and related abuse on Telegram.

**Status:** project scaffolded; product workflow and first deployment are pending.

## Project setup

- Serverless CLI: `@tgcloud/cli@0.2.0`
- Project path: `bots/ScamGiveawaysBot`
- GitHub Actions secret: `TGCLOUD_TOKEN_SCAMGIVEAWAYSBOT`
- Serverless app ID: derived from the scoped CLI token; do not hardcode or guess it.
- Manual workflow: **Actions → Telegram Serverless CLI**; choose `bots/ScamGiveawaysBot`, `FROM_TOKEN`, and `status` first.
- Automatic deployment: intentionally disabled until the initial deployment and live Telegram tests are verified.

## Current scaffold

- `tgcloud/handlers/message.js` — starter message handler, to be replaced with scam-reporting flows.
- `tgcloud/schema.js` — currently empty schema placeholder.
- `tgcloud.jsonc` — Serverless project configuration; no Mini App/static hosting is configured.
- `docs/tgcloud-sdk.md` — generated SDK reference.
- `AGENTS.md` — project-specific coding, safety, and deployment rules.

## Product decisions still needed

Before implementing the report workflow, decide:
1. What users can submit (Telegram profile/channel/group, giveaway, message, URL, wallet address, or other evidence).
2. Whether reports go to a private moderator group/channel, an admin inbox, or both.
3. Whether reports are published publicly, searchable, or kept private until moderators confirm them.
4. How users track a report and request a correction or appeal.

Reports must be treated as allegations until reviewed. Do not expose reporter identity or publish accusations as verified facts without a moderation policy and evidence review.

## Serverless notes

The runtime is Telegram's isolated V8 environment. Use documented `sdk` APIs and the built-in SQLite database; do not rely on Node.js built-ins, arbitrary npm packages, a persistent process, or local filesystem storage at runtime.

Deploy code with `npx tgcloud push`. Schema deployment does not apply database changes; migrations are separate and require explicit review and approval. Never commit `.tgcloud/`, `node_modules/`, tokens, or credentials.
