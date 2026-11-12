# ScamGiveawaysBot

A minimal, global Telegram scam-reporting bot with administrator review before public publication.

**Status:** moderation and channel configuration are implemented in source. Database migration, deployment, and live Telegram testing remain pending.

## User flow

1. `/start` shows a clean welcome message and one **Report** button.
2. The report wizard collects the reported Telegram username, amount (without assuming a currency or region), summary, and a public evidence source.
3. The user's submitted text messages are deleted after each step; the bot edits the same prompt.
4. The preview uses a native expandable blockquote for the summary and a Rich Text link button for the evidence source.
5. The user submits the report for administrator review and receives a pending confirmation.
6. Both configured administrators receive the report with **Approve and publish** and **Decline report** actions.
7. Approval publishes the report to the channel configured in `/admin`; decline does not publish it. The reporter receives a private outcome notification.

Reports are allegations, not verified findings. Public posts retain a clear unverified/allegation disclaimer. The bot does not fetch user-supplied evidence URLs.

## Admin controls

Authorized administrator IDs are `6522801911` and `1314643983`.

- `/admin` opens the private admin panel.
- **Configure channel** accepts a public channel username or numeric channel ID. The bot verifies that it is a channel and that the bot has administrator posting permission before saving it.
- **Reset test data** requires a confirmation step and deletes report drafts, admin sessions, and stored reports while preserving the configured publishing channel.
- `/resetdb` opens the same confirmation flow. It is a temporary administrative utility and should be removed after testing.

## Database and deployment

- Serverless CLI: `@tgcloud/cli@0.2.0`
- Project path: `bots/ScamGiveawaysBot`
- GitHub Actions secret: `TGCLOUD_TOKEN_SCAMGIVEAWAYSBOT`
- Auto-deployment: disabled.
- New schema tables/columns require a deliberate migration. Do not run `npx tgcloud migrate` without explicit user approval.
- Deploying schema code is not the same as applying its migration. Existing installations must apply the reviewed migration before using the updated handlers.

## Runtime layout

- `tgcloud/handlers/message.js` — report wizard, admin commands, channel configuration.
- `tgcloud/handlers/callback_query.js` — report submission, moderation, publishing, and reset confirmation.
- `tgcloud/lib/formatting.js` — user, report, and admin Rich Messages.
- `tgcloud/lib/sessions.js` — report drafts, admin sessions, and settings.
- `tgcloud/schema.js` — report drafts, admin sessions, settings, and reports.
- `docs/tgcloud-sdk.md` — generated Serverless SDK reference.

The source is kept manual-deploy only until first deployment and live tests are complete.
