# Telegram Cloud Sandbox

A reusable public workspace for building multiple Telegram BotFather Serverless bots with the official `tgcloud` CLI.

## Layout

- `bots/<BotName>/` — one self-contained CLI project per bot.
- `.github/workflows/tgcloud.yml` — manually triggered status check or deployment for a selected bot.

Each bot has its own `package.json`, `tgcloud.jsonc`, and `tgcloud/` modules. Do not copy a bot's `.tgcloud/` local state or credentials into Git.

## One-time setup

1. In this repository, open **Settings → Secrets and variables → Actions → New repository secret**.
2. Set the secret name to `TGCLOUD_TOKEN`.
3. Paste the CLI access token for the bot you intend to work on. Obtain it from BotFather → that bot → Serverless → CLI Access. This is not the Bot API token. Never commit it or send it in chat.

The repository secret is a single active token, as requested. When switching to another bot, replace the secret with that bot's CLI access token before running the workflow. The workflow also requires the matching numeric app ID and checks it against the token before doing anything.

## Run a bot

1. Open **Actions → Telegram Serverless CLI → Run workflow**.
2. Select branch `main`.
3. Set **Bot path** (for example `bots/BotZoneBot`).
4. Enter the numeric app ID from the token's public `app<id>:` prefix.
5. Run with mode **status** first to inspect the selected bot. Choose **deploy** only when you intend to publish the code.

The workflow uses `TGCLOUD_TOKEN` only as an environment variable, fetches the remote state, and runs the CLI from the selected bot directory. Deployment uses a targeted `tgcloud push` of the local JavaScript modules, avoiding a full-project mirror operation that could delete other cloud modules.

## Adding another bot

Create a new directory directly under `bots/` using the official scaffold, then copy its project files into that folder. Keep each bot's own package and `tgcloud/` modules, but omit `.tgcloud/` and `node_modules/`. Commit the source files, switch the `TGCLOUD_TOKEN` repository secret to the new bot's CLI access token, and dispatch the workflow with that folder and its matching app ID.

## Security notes

- This repository is public. Never commit credentials or sensitive data; keep tokens only in GitHub Actions secrets.
- Never add CLI tokens, Bot API tokens, or `.tgcloud/credentials` to source control.
- The workflow does not print the token. Its app ID check prevents deploying to the wrong bot when the secret and selected target disagree.
