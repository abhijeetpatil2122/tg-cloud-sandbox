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

The separate **Telegram Serverless Auto Deploy** workflow watches pushes to `main` under `bots/**`. It filters the commit diff and deploys only explicitly enabled bots whose runtime/configuration files changed.

- RichDocsBot is the first enabled bot (app ID `8626465761`).
- BotZoneBot remains manual-only.
- Documentation-only changes do not trigger a deploy.
- Every automatic run validates changed projects and JavaScript syntax. If a project configures static hosting in `tgcloud.jsonc`, CI builds its Mini App and a full `tgcloud push` deploys the frontend and backend modules together. That full push mirrors local modules to the cloud, including deletions. Non-static bots keep using targeted module pushes.
- Root documentation/workflow-only commits do not deploy a bot.
- Automatic deployment never runs database migrations. Static Mini App builds are deployed with their bot when `tgcloud.jsonc` configures a static source; database changes still require a separate, reviewed migration.

When adding a bot, leave automatic deployment disabled until its app ID and dedicated secret are confirmed and its registry entry is deliberately enabled in `.github/workflows/tgcloud-auto-deploy.yml`.

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
