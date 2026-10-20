# Rich Message Editor — Telegram Serverless

This is the RichEditor Mini App migrated from Vercel into Telegram BotFather Serverless.

## Features

- Original React/Vite editor and formatting tools.
- Serverless endpoints for Rich Message sending, chat verification, avatar previews, SQLite-backed saved chats, and chunked media uploads.
- Saved channels and groups are stored in this bot's own SQLite database.
- No legacy CloudStorage import is performed; this is a fresh BotZoneBot setup.

## SQLite database

Telegram Serverless provides a separate SQLite-backed database for each bot. This app uses tgcloud/schema.js to declare three tables:

- saved_chats: the only permanent application data, saved per user.
- media_upload_sessions: temporary upload metadata.
- media_upload_chunks: temporary upload chunks, removed after success/cancellation and expired after 24 hours.

The unused demo_notes scaffold table has been dropped. No demo notes data remains in this bot database.

## Media uploads

Files are read with FileReader for compatibility with Telegram's embedded Android WebView, sent to Serverless in 512 KiB chunks, reassembled as a Uint8Array, and uploaded with the documented SDK InputFile API. The bot token is never exposed to the frontend.

Telegram Bot API limits apply: photos are limited to 10 MB; other supported file types are limited to 20 MB in this Mini App.

## App

- App ID: 8747772496
- Hosted URL: https://app8747772496.tgcloud.ai/

Build with npm run build; validate Serverless modules with node --check. Review npx tgcloud status before deployment because a full push mirrors module deletions as well as additions.
