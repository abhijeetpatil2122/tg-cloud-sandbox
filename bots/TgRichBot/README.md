# TgRichBot — Rich Message Editor

Production instance of the Rich Message Editor Mini App, hosted on Telegram BotFather Serverless for @TgRichBot.

## Features

- Original React/Vite editor and formatting tools.
- Serverless endpoints for Rich Message sending, chat verification, avatar previews, SQLite-backed saved chats, and chunked media uploads.
- Saved channels and groups are stored in this bot's own SQLite database.
- This is an independent production deployment with its own Telegram Serverless SQLite database. The test bot remains separate.

## SQLite database

Telegram Serverless provides a separate SQLite-backed database for each bot. This app uses tgcloud/schema.js to declare three tables:

- saved_chats: the only permanent application data, saved per user.
- media_upload_sessions: temporary upload metadata.
- media_upload_chunks: temporary upload chunks, removed after success/cancellation and expired after 24 hours.

The unused demo_notes scaffold table has been dropped. No demo notes data remains in this bot database.

## Editor spacing

The editor includes an adjustable spacing block (1–8 lines). Like the original Vercel editor, it serializes to empty paragraph blocks because spacing is an editor convenience rather than a standalone Telegram Rich Block.

## Media uploads

Files are read with FileReader for compatibility with Telegram's embedded Android WebView, sent to Serverless sequentially in 512 KiB chunks, reassembled as a Uint8Array, and uploaded with the documented SDK InputFile API. The bot token is never exposed to the frontend. The backend enforces the chunk size and verifies the assembled file size before sending it to Telegram.

Telegram Bot API limits apply: photos are limited to 10 MB; other supported file types are limited to 20 MB in this Mini App.

## App

- Bot: https://t.me/TgRichBot
- App ID: derived and verified from the `TGCLOUD_TOKEN_TGRICHBOT` Actions secret during deployment.
- Hosted URL: `https://app<app-id>.tgcloud.ai/` (the app ID is read from that token).

Build with npm run build; validate Serverless modules with node --check. Review npx tgcloud status before deployment because a full push mirrors module deletions as well as additions.
