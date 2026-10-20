# Rich Message Editor — Telegram Serverless

A Telegram Mini App for building Bot API Rich Messages and publishing them to your private chat or a saved channel/group. This is the RichEditor app migrated from Vercel into Telegram BotFather Serverless.

## What is included

- The original React/Vite editor UI and its block editing, inline formatting, media, tables, buttons, undo/redo, settings, and Telegram theme integration.
- Native Telegram Mini App hosting through `tgcloud.jsonc`.
- Serverless endpoints for chat verification, Rich Message publishing, media uploads, and media previews.
- A Serverless message handler for `/start`, `/help`, `/howtouse`, and `/about`.
- Telegram CloudStorage for each user's saved channels/groups. The app has no application-owned database table, so no SQLite schema migration is required for this data.

## Serverless endpoints

| Endpoint module | Purpose |
|---|---|
| `tgcloud/endpoints/verifyChat.js` | Checks the target is a channel/group/supergroup and verifies the bot can post |
| `tgcloud/endpoints/sendRichMessage.js` | Validates and publishes the Rich Message to the user's private chat or a verified target |
| `tgcloud/endpoints/uploadMedia.js` | Uploads selected media to the user's private chat and returns its Telegram `file_id` |
| `tgcloud/endpoints/getMediaPreview.js` | Returns a data URL for small chat-avatar/media previews without exposing the bot token |

All endpoints use the identity validated by Telegram Serverless through `ctx.initData.user`. The frontend does not send its own user ID for authorization and never receives a bot token.

## Development

From this directory:

```sh
npm install
npm run dev
npm run build
npx tgcloud status
```

The local Vite server is useful for layout work, but Serverless calls and CloudStorage require a real Telegram Mini App launch.

## Deploy

The Serverless app ID is `8747772496`; its hosted URL is:

```text
https://app8747772496.tgcloud.ai/
```

The sandbox's existing manual workflow can run a status check for this project. The automatic deployment registry is unchanged; it deploys BotZoneBot only when eligible changes reach `main`. Review the CLI status/diff before any intentional full push because it mirrors local modules and static assets, including deletions.

After deployment, configure this URL as the bot's Main Mini App or Menu Button URL in BotFather if it is not already configured.

## Important implementation notes

- Runtime modules use only the built-in `sdk` and project-relative imports ending in `.js`.
- The existing Vercel API routes have been replaced with `tgcloud/endpoints/` and `tgcloud/handlers/message.js`; no Vercel functions, Node built-ins, or Vercel config are deployed.
- Media uploads use the Serverless SDK's `InputFile`; media preview uses `api.getFileContent`.
- Saved chat records remain in Telegram CloudStorage, per user and per bot. No app-specific database migration is needed.
