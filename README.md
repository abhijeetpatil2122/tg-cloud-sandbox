# Telegram Cloud Sandbox

A reusable workspace for building multiple Telegram BotFather Serverless bots with Telegram's official `tgcloud` CLI.

## Start here

- **[AGENTS.md](./AGENTS.md)** — repository-wide instructions for AI coding agents, Serverless runtime constraints, deployment safety, and how to add bots.
- `bots/NAME/` — one self-contained CLI project per bot.
- `.github/workflows/tgcloud.yml` — manual status check or deployment for a selected bot.
- `.github/workflows/tgcloud-auto-deploy.yml` — automatic deployment for explicitly enabled bots after deployable code/config changes are committed to `main`.

Each bot has its own `package.json`, `tgcloud.jsonc`, and `tgcloud/` modules. Do not copy a bot's `.tgcloud/` local state or credentials into Git.

## One-time setup

Add a separate repository Actions secret for each bot:

| Bot path | Actions secret | Auto-deploy |
|---|---|---|
| `bots/BotZoneBot` | `TGCLOUD_TOKEN` | Disabled (manual only) |
| `bots/RichDocsBot` | `TGCLOUD_TOKEN_RICHDOCSBOT` | Enabled on `main` |

Get each token from BotFather → that bot → Serverless → CLI Access. This is the Serverless CLI token, not the ordinary Bot API token. Never commit a token or send it in chat. The workflows validate that the token's `app<id>:` prefix matches the configured numeric app ID.

## Manual status and deployment

1. Open Actions → **Telegram Serverless CLI** → Run workflow.
2. Select branch `main`.
3. Set the bot path, for example `bots/BotZoneBot` or `bots/RichDocsBot`.
4. Enter the bot's numeric Serverless app ID.
5. Run `status` first to inspect the selected bot. Choose `deploy` only when you intend to publish the code.

The manual workflow validates the project, checks JavaScript syntax, verifies the selected bot's CLI token, fetches remote state and runs the CLI from that bot directory. Deployment uses a targeted `tgcloud push` of JavaScript modules instead of a full-project mirror operation that could delete unrelated cloud modules.

## Automatic deployment

The separate **Telegram Serverless Auto Deploy** workflow watches pushes to `main` under `bots/**`. It validates changed projects and deploys only explicitly enabled bots whose runtime/configuration files changed. For a bot with native Mini App hosting configured, frontend/build changes also trigger validation and are eligible for deployment.

- RichDocsBot is the first enabled bot (app ID `8626465761`).
- BotZoneBot is enabled for automatic deployment with app ID `8747772496`, using the `TGCLOUD_TOKEN` Actions secret; the workflow validates that the secret matches the app ID before pushing.
- Documentation-only changes do not trigger a deploy.
- Every automatic run validates changed projects and JavaScript syntax. If a project configures static hosting in `tgcloud.jsonc`, CI builds its Mini App and a full `tgcloud push` deploys the frontend and backend modules together. That full push mirrors local modules to the cloud, including deletions. Non-static bots keep using targeted module pushes.
- Root documentation/workflow-only commits do not deploy a bot.
- Automatic deployment never runs database migrations. Static Mini App builds are deployed with their bot when `tgcloud.jsonc` configures a static source; database changes still require a separate, reviewed migration.

When adding a bot, leave automatic deployment disabled until its app ID and dedicated secret are confirmed and its registry entry is deliberately enabled in `.github/workflows/tgcloud-auto-deploy.yml`.

## Native Mini App hosting and backend APIs

Telegram Serverless now hosts a bot's built Mini App and backend endpoints alongside its handlers. For a Vite app, configure `tgcloud.jsonc` to serve `dist/`; `tgcloud push` deploys the build and modules together. The app URL is printed by the CLI as `https://app<app_id>.tgcloud.ai/` and can be set in BotFather's Menu Button or Main Mini App settings.

Place endpoint functions in `bots/NAME/tgcloud/endpoints/`. The frontend calls them through `Telegram.WebApp.Serverless.call(name, input, callback)`; Telegram Serverless validates the Mini App session and provides trusted identity in `ctx.initData`. Use the built-in `sdk` for endpoint logic and the bot's SQLite-backed database. Schema migrations remain a separate, reviewed step and are never run automatically by CI.

The demo implementation lives in `bots/BotZoneBot/`. It is intentionally **manual-deploy only** while we confirm its app ID and initial cloud state.

## Bots

- **BotZoneBot** — end-to-end Mini App demo with a React + Vite frontend, authenticated Serverless endpoints, and persistent per-user notes.
- **RichDocsBot** — inline search over the official Telegram Bot API schema and separate error catalogue, returning documentation as native Rich Messages.

## Adding another bot

1. Create a new directory under `bots/` using the official scaffold, then copy its project files into that folder.
2. Keep its package and `tgcloud/` modules, but omit `.tgcloud/` and `node_modules/`.
3. Add a dedicated GitHub Actions secret for its Serverless CLI token.
4. Add an explicit bot-path-to-secret mapping in `.github/workflows/tgcloud.yml`.
5. Run the manual workflow in `status` mode and verify the app ID before deploying.
6. Only after the bot is tested, add its app ID, secret mapping and auto-deploy flag to `.github/workflows/tgcloud-auto-deploy.yml`.

## Runtime and security notes

- Telegram Serverless handlers run in Telegram's V8-isolate runtime, not as a persistent Node.js server and not as Vercel Functions. The GitHub Actions runner uses Node.js to install and run the deployment CLI; this does not change the bot runtime.
- Use the official `sdk` imports and supported Telegram Serverless APIs in runtime code. Do not assume Node built-ins, arbitrary npm packages, a persistent filesystem or long-running background processes are available.
- Never commit CLI tokens, Bot API tokens, `.tgcloud/` credentials, `.env` files or other sensitive data. The repository is public.
- Schema deployment and database migration are separate operations. Never migrate automatically.
- See [AGENTS.md](./AGENTS.md) and each bot's own `AGENTS.md` for the full workflow and development rules.

Official docs: https://core.telegram.org/bots/serverless
