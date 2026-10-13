# Telegram Cloud Sandbox

A reusable public workspace for building multiple Telegram BotFather Serverless bots with the official tgcloud CLI.

## Layout

- bots/<BotName>/ — one self-contained CLI project per bot.
- .github/workflows/tgcloud.yml — manually triggered status check or deployment for a selected bot.

Each bot has its own package.json, tgcloud.jsonc, and tgcloud/ modules. Do not copy a bot's .tgcloud/ local state or credentials into Git.

## One-time setup

Add a separate repository Actions secret for each bot:

| Bot path | Secret name |
|---|---|
| bots/BotZoneBot | TGCLOUD_TOKEN |
| bots/RichDocsBot | TGCLOUD_TOKEN_RICHDOCSBOT |

Get each token from BotFather → that bot → Serverless → CLI Access. This is the Serverless CLI token, not the ordinary Bot API token. Never commit a token or send it in chat. The workflow selects the matching secret from the bot path and checks that the token's app<id>: prefix matches the numeric app ID entered in the form.

## Run a bot

1. Open Actions → Telegram Serverless CLI → Run workflow.
2. Select branch main.
3. Set Bot path, for example bots/BotZoneBot or bots/RichDocsBot.
4. Enter that bot's numeric Serverless app ID.
5. Run with mode status first to inspect the selected bot. Choose deploy only when you intend to publish the code.

The workflow fetches remote state and runs the CLI from the selected bot directory. Deployment uses a targeted tgcloud push of local JavaScript modules, avoiding a full-project mirror operation that could delete unrelated cloud modules.

## Bots

- **BotZoneBot** — Rich Message feature showcase and test bot.
- **RichDocsBot** — inline search over the official Telegram Bot API OpenAPI schema, returning documentation as native Rich Messages. Error-reference search is planned for a later phase.

## Adding another bot

Create a new directory directly under bots/ using the official scaffold, then copy its project files into that folder. Keep each bot's own package and tgcloud/ modules, but omit .tgcloud/ and node_modules/. Add a dedicated Actions secret and update the explicit secret mapping in .github/workflows/tgcloud.yml for that bot path.

## Security notes

- This repository is public. Never commit credentials or sensitive data; keep tokens only in GitHub Actions secrets.
- Never add CLI tokens, Bot API tokens, or .tgcloud/credentials to source control.
- The workflow does not print tokens. Its app ID check prevents deploying to the wrong bot when the secret and selected target disagree.
