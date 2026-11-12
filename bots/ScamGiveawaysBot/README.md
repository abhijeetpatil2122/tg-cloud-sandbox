# ScamGiveawaysBot

A minimal, global Telegram scam-reporting bot with administrator review before public publication.

**Status:** moderation, channel configuration, and first-start user tracking are implemented in source. Database migration, deployment, and live Telegram testing remain pending.

## User flow

1. /start shows a clean welcome message and one Report button.
2. On a user's first /start, the bot stores their Telegram ID, username, display name, first/last start timestamps, and start count.
3. A first-time start sends a private notification to the configured administrators only. It includes a clickable user name, Telegram ID, username, and total registered-user count. Repeated starts update the user's record without sending another new-user notification.
4. The report wizard collects the reported Telegram username, amount (without assuming a currency or region), summary, and a public evidence source.
5. The user's submitted text messages are deleted after each step; the bot edits the same prompt.
6. The preview uses a native expandable blockquote for the summary and a Rich Text link button for the evidence source.
7. The user submits the report for administrator review and receives a pending confirmation.
8. Both configured administrators receive the report with side-by-side Approve and publish (green) and Decline report (red) actions.
9. Approval publishes the report to the channel configured in /admin; decline does not publish it. The reporter receives a private outcome notification.

Public posts omit the internal report number, retain a concise allegation disclaimer, and end with Submit a report: @ScamGiveawaysBot. The bot does not fetch user-supplied evidence URLs.

## Admin controls

Authorized administrator IDs are 6522801911 and 1314643983.

- /admin opens the private admin panel.
- /stats shows total registered users, total reports, pending reports, and published reports.
- Configure channel accepts a public channel username or numeric channel ID. The bot verifies that it is a channel and that the bot has administrator posting permission before saving it.
- Reset test data requires confirmation and deletes report drafts, admin sessions, and stored reports while preserving channel configuration and registered-user analytics.
- /resetdb opens the same confirmation flow. It is a temporary administrative utility and should be removed after testing.

## Database and deployment

- Serverless CLI: @tgcloud/cli@0.2.0
- Project path: bots/ScamGiveawaysBot
- GitHub Actions secret: TGCLOUD_TOKEN_SCAMGIVEAWAYSBOT
- Auto-deployment: disabled.
- New schema tables/columns require a deliberate migration. Do not run npx tgcloud migrate without explicit user approval.
- Deploying schema code is not the same as applying its migration. Existing installations must apply the reviewed migration before using the updated handlers.
- The bot_users table is additive; existing users are registered the next time they send /start.

## Runtime layout

- tgcloud/handlers/message.js — report wizard, first-start registration, admin commands, channel configuration, and stats.
- tgcloud/handlers/callback_query.js — report submission, moderation, publishing, and reset confirmation.
- tgcloud/lib/formatting.js — user, report, and admin Rich Messages.
- tgcloud/lib/sessions.js — report drafts, admin sessions, and settings.
- tgcloud/schema.js — report drafts, admin sessions, settings, bot users, and reports.
- docs/tgcloud-sdk.md — generated Serverless SDK reference.

The source is kept manual-deploy only until first deployment and live tests are complete.
