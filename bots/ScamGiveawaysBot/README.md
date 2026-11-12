# ScamGiveawaysBot

A minimal Telegram bot for submitting reports about suspected scam accounts and fake giveaways.

**Status:** report wizard implemented in source; database migration, first deployment, and live Telegram testing are pending.

## User flow

1. `/start` shows a clean welcome message with the user's first and last name and one **Report** button.
2. The report wizard edits that same bot message through four steps: scammer handle, amount involved, short summary, and proof channel.
3. The user's submitted text messages are deleted after each step. The bot prompt stays in place and includes **Cancel ❌**.
4. Cancellation edits the prompt to a cancellation notice with a Back to menu button.
5. A complete preview offers Edit report, Publish, and Cancel. Edit lets the user correct any of the four fields.
6. Publish sends a formatted report post to the user's private chat and stores it as a `private_test` submission. No public channel is connected yet.

Reports are allegations, not verified findings. Do not publish them publicly until moderation, evidence review, privacy, and correction/appeal procedures are implemented.

## Project setup

- Serverless CLI: `@tgcloud/cli@0.2.0`
- Project path: `bots/ScamGiveawaysBot`
- GitHub Actions secret: `TGCLOUD_TOKEN_SCAMGIVEAWAYSBOT`
- Manual deployment: **Actions → Telegram Serverless CLI**; select `bots/ScamGiveawaysBot`, `FROM_TOKEN`, and run `status` before any deploy.
- Auto-deployment: disabled.
- Validation: `.github/workflows/scamgiveaways-validation.yml` installs the pinned CLI dependencies and syntax-checks runtime modules.

## Runtime layout

- `tgcloud/handlers/message.js` — commands, step input, validation, and deleting user submissions.
- `tgcloud/handlers/callback_query.js` — Report, Cancel, Back, Edit, Preview, and Publish actions.
- `tgcloud/lib/formatting.js` — welcome, prompt, preview, and private report Rich Messages.
- `tgcloud/lib/sessions.js` — persistent draft helpers.
- `tgcloud/schema.js` — `report_drafts` and `scam_reports` tables.
- `docs/tgcloud-sdk.md` — generated Serverless SDK reference.

## Important deployment note

The new tables require a database migration. Deploying `schema.js` alone does not create them. Review the migration plan and obtain explicit approval before running `npx tgcloud migrate`. No migration or production deployment has been run as part of this implementation.

Runtime modules use only documented Serverless SDK imports; no Node.js built-ins or third-party runtime dependencies are used.
