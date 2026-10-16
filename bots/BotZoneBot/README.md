# Telegram Mini App Demo

BotZoneBot is being repurposed from the Rich Message playground into the end-to-end Telegram Mini App demo for this workspace.

## What it demonstrates

- A React + Vite Mini App built into `dist/`.
- Native static hosting on Telegram Serverless at `https://app<APP_ID>.tgcloud.ai/`.
- Backend endpoints in `tgcloud/endpoints/`, called with `Telegram.WebApp.Serverless.call`.
- Server-verified Telegram user identity via `ctx.initData`.
- A per-bot SQLite-backed notes table in `tgcloud/schema.js`.
- A bot message handler and an authenticated Mini App frontend.

## Development

From this directory:

```sh
npm install
npm run dev
npm run build
npx tgcloud status
```

## Backend endpoints

| Module | Endpoint | Purpose |
|---|---|---|
| `tgcloud/endpoints/getDemoStatus.js` | `POST /api/getDemoStatus` | Returns server time and Telegram identity verified by Serverless |
| `tgcloud/endpoints/listDemoNotes.js` | `POST /api/listDemoNotes` | Lists the current user's 10 most recent notes |
| `tgcloud/endpoints/saveDemoNote.js` | `POST /api/saveDemoNote` | Validates and saves a note for the verified user |

The frontend calls these using `Telegram.WebApp.Serverless.call()`. The platform authenticates the Mini App request and supplies `ctx.initData` to each endpoint. The frontend does not send a user ID for authorization.

## Deploy

The manual GitHub Actions workflow is the safe first deployment path. Select `bots/BotZoneBot`, enter the numeric app ID matching its `TGCLOUD_TOKEN` secret, and run `status` first. Choose `deploy` only when ready. A Mini App project builds its frontend and uses a full `tgcloud push` so the configured static output and modules are published together.

A full push mirrors the local project to the cloud and removes cloud modules missing locally. Review status/diff before deploying.

After the first successful deployment, use the URL printed by `tgcloud push` in BotFather's Menu Button or Main Mini App settings.

## Database setup

Schema deployment and database migration are separate. After the first code deployment, run `npx tgcloud migrate` from this project in an interactive terminal and review the proposed change before confirming it. The notes feature will not work until the `demo_notes` table exists.

## Security

The frontend never receives a bot or Serverless token. Endpoints rely on Telegram Serverless to validate Mini App init data; they use `ctx.initData.user` as the trusted user identity. Do not trust `initDataUnsafe` for authorization.
