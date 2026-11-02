# SarvamChatBot

A Telegram private-chat AI assistant powered by Sarvam 105B. It streams answers through Telegram Rich Message drafts, can stop generation from the Telegram Stop button, and uses Tavily live search for current facts and news when Sarvam decides it is needed.

## Current scope

- Private chats only. Groups and Guest Mode are deliberately not handled.
- Sarvam Chat Completions V2 (sarvam-105b) with SSE streaming.
- Rich Markdown drafts while generating and a complete Rich Message as the final answer.
- Telegram Stop button using can_stop, keep_on_stop and the stopped_message_generation update.
- Per-user conversation history and /reset.
- Optional Tavily web_search function tool. The model decides when a lookup is necessary.
- News searches use Tavily's news topic, a recent time window, publication dates and live page fetching. Final answers cite the returned source URLs.

## Configure API keys

Telegram Serverless' current official docs do not document runtime environment variables or a native secret store. GitHub Actions secrets are not automatically available inside deployed modules. Configure both provider keys through private bot commands instead.

### Sarvam

After deploying the schema and applying its migration, send:

/setkey YOUR_SARVAM_API_KEY

The first user to set the Sarvam key becomes the bot configuration owner. Only that user can rotate either provider key. The bot attempts to delete the credential command message and never echoes or logs the key.

### Tavily live search

Create a Tavily API key, then send:

/setsearchkey YOUR_TAVILY_API_KEY

Live search remains disabled until this key is configured. Tavily is used only when Sarvam decides the question needs current information or source verification. The bot performs at most one search call per user turn and returns up to six sources. Basic search uses one Tavily credit; advanced search uses two. News queries use topic=news and request live page fetching.

Keys are stored in the bot's SQLite-backed bot_settings row. This is application-level database storage, not end-to-end encrypted secret storage. Avoid forwarding or screenshotting credential commands.

## Deploy

Repository: abhijeetpatil2122/tg-cloud-sandbox

Project path: bots/SarvamChatBot

CLI token Actions secret: TGCLOUD_TOKEN_SARVAMCHATBOT

Run Actions → Telegram Serverless CLI:
- bot_path: bots/SarvamChatBot
- expected_app_id: FROM_TOKEN
- mode: status first, then deploy when ready

This update adds the optional tavily_api_key column to bot_settings and the new active_generations table. Deploy the schema, review and apply the additive database migration separately, then configure the Tavily key with /setsearchkey. The workflow never runs migrations.

## Commands

- /start — introduction and configuration status.
- /help — usage and setup help.
- /setkey YOUR_SARVAM_API_KEY — configure or rotate Sarvam.
- /setsearchkey YOUR_TAVILY_API_KEY — configure or rotate live search.
- /reset — clear the invoking user's conversation history.

## Accuracy and source handling

The system prompt directs Sarvam to distinguish facts from estimates, ask clarifying questions when ambiguity matters, use official sources for technical questions, and avoid claiming live verification without search. Tavily snippets are treated as untrusted data; webpage instructions are never followed. When search is used, the final answer is instructed to cite actual returned URLs and publication dates.

See AGENTS.md for implementation constraints, cancellation behavior, privacy rules and the future Guest Mode/group roadmap.
