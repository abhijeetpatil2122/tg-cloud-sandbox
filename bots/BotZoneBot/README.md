# Rich Message Editor — Telegram Serverless

This is the RichEditor Mini App migrated from Vercel into Telegram BotFather Serverless.

## Features

- Original React/Vite editor and formatting tools.
- Serverless endpoints for Rich Message sending, chat verification, avatar previews, SQLite-backed saved chats, and chunked media uploads.
- Saved channels and groups are stored per Telegram user in SQLite, replacing the old per-user Telegram CloudStorage records.
- The old Vercel functions are not used by this app.

## SQLite

The schema lives in `tgcloud/schema.js`. The only permanent app data stored in SQLite is the user's saved chats. Temporary upload-session and chunk tables support chunked media upload; they are cleaned up after completion/cancellation and stale records are removed after 24 hours. Schema deployment records pending changes; it does not apply database migrations automatically. Review the create-table/index migrations with `npx tgcloud migrate` before using the SQLite-backed saved-chat endpoints.

No old table is dropped. The previous demo table, if still present in the database, is left untouched.

## Media uploads

Files are sent to Serverless in 512 KiB chunks to avoid one oversized JSON/Base64 request. Chunks are temporarily stored in SQLite, reassembled as a `Uint8Array`, uploaded using `InputFile`, and deleted after a successful upload or cancellation. Stale chunks are cleaned up after 24 hours.

Telegram Bot API limits still apply: photo uploads are limited to 10 MB; other supported file types are limited to 20 MB for this Mini App because the file-preview/download API is capped at 20 MB.

## App

- App ID: `8747772496`
- Hosted URL: `https://app8747772496.tgcloud.ai/`

Build with `npm run build`; validate Serverless modules with `node --check`. Review `npx tgcloud status` before deployment because a full push mirrors module deletions as well as additions.
