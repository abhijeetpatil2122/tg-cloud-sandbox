# Rich Message Editor — Telegram Serverless

This is the RichEditor Mini App migrated from Vercel into Telegram BotFather Serverless.

## Features

- Original React/Vite editor and formatting tools.
- Serverless endpoints for Rich Message sending, chat verification, avatar previews, SQLite-backed saved chats, and chunked media uploads.
- SQLite tables for users, saved chats, upload sessions/chunks, media upload history, and bot-level usage events.
- A channel-sharing flow using Telegram's native request-chat keyboard, asking for the minimum channel administrator rights needed to post.
- The old Vercel functions are not used by this app.

## SQLite

The schema lives in \`tgcloud/schema.js\`. New tables are additive. Deploying the schema records pending changes; it does not apply database migrations automatically. Review and apply the safe create-table/index migrations with \`npx tgcloud migrate\` before using the SQLite-backed endpoints.

No old table is dropped. The previous demo table, if still present in the database, is left untouched.

## Media uploads

Files are sent to Serverless in 512 KiB chunks to avoid one oversized JSON/Base64 request. Chunks are temporarily stored in SQLite, reassembled as a \`Uint8Array\`, uploaded using \`InputFile\`, and deleted after a successful upload or cancellation. Stale chunks are cleaned up after 24 hours.

Telegram Bot API limits still apply: photo uploads are limited to 10 MB; other supported file types are limited to 20 MB for this Mini App because the file-preview/download API is capped at 20 MB.

## Chat sharing

Use **Share channel & add bot** in Settings. The bot sends a native Telegram chat-request keyboard in the private chat. Selecting a channel asks the user to confirm the bot's administrator permissions. The resulting \`chat_shared\` update is validated, saved to SQLite, and shown in the Mini App after refreshing or reopening Settings.

## App

- App ID: \`8747772496\`
- Hosted URL: \`https://app8747772496.tgcloud.ai/\`

Build with \`npm run build\`; validate Serverless modules with \`node --check\`. Review \`npx tgcloud status\` before deployment because a full push mirrors module deletions as well as additions.
