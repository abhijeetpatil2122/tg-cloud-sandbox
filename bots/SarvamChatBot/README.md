# SarvamChatBot

A Telegram private-chat AI assistant powered by Sarvam 105B. It streams answers through Telegram Rich Message drafts, finalizes stopped drafts as permanent Rich Messages, recovers interrupted generations, and uses Tavily live search for current facts and news when Sarvam decides it is needed.

## Current scope

- Private chats only. Groups and Guest Mode are deliberately not handled.
- Sarvam Chat Completions V2 (sarvam-105b) with SSE streaming.
- Rich Markdown drafts while generating and a complete Rich Message as the final answer.
- Telegram Stop button using can_stop, keep_on_stop and the stopped_message_generation update; stopped partial answers are persisted with sendRichMessage.
- Task-aware tg-thinking states use Telegram's recommended AIActions custom-emoji pack when available, with standard emoji fallbacks.
- Stale generation recovery after a Serverless invocation has ended; the original prompt and recovered partial are saved to history so sending “continue” resumes the answer. /reset also clears any active or stuck generation lock.
- Output is capped conservatively at 28,000 UTF-8 bytes (below Telegram's 32,768-byte Rich Message limit) and 4,096 model tokens. Truncated or incomplete streams are labelled rather than silently presented as complete.
- Rich formatting guidance covers Markdown/HTML, spoiler and marked text, sub/superscript, LaTeX math, anchors, URL/copy buttons, and responsive table choices. Tables are kept narrow and use explicit bordered/striped/compact styles only when appropriate.
- Final delivery retries the Rich HTML representation if Rich Markdown fails, then falls back to readable plain text.
- Per-user conversation history and /reset.
- Optional Tavily web_search function tool. The model decides when a lookup is necessary. Search supports fast/basic/advanced depth, domain filters, exact matching, country boosts for general searches, and up to eight deduplicated sources.
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

Deployable changes under this project are detected by the repository's Telegram Serverless Auto Deploy workflow on pushes to main. The workflow validates the project, checks JavaScript syntax, verifies the scoped token's embedded app ID, then pushes only the bot's runtime modules. It does not run database migrations.

For a manual status check or intentional manual deployment, use Actions → Telegram Serverless CLI with:
- bot_path: bots/SarvamChatBot
- expected_app_id: FROM_TOKEN
- mode: status or deploy

The current recovery, Stop, and thinking-state changes do not alter the database schema, so they require no new migration. The earlier tavily_api_key and active_generations migration remains part of the previously deployed feature.

## Commands

- /start — introduction and configuration status.
- /help — usage and setup help. The command menu is registered automatically when the user starts the bot or requests help.
- /setkey YOUR_SARVAM_API_KEY — configure or rotate Sarvam.
- /setsearchkey YOUR_TAVILY_API_KEY — configure or rotate live search.
- /reset — clear the invoking user's conversation history and release any active or stuck generation.
- If a response is recovered after a runtime interruption, send “continue” to resume from the saved prompt and partial answer.

## Formatting and reliability

The assistant is instructed to balance answer length with the user's request, avoid repeated summaries and decorative formatting, and optimize tables for phone screens. It uses Telegram's native Rich Markdown/HTML support instead of invented tags. Help list items use the required nested Rich Block structure. Provider errors are classified using Sarvam's status and error codes (including exhausted credits, invalid keys, rate limits, model overload and invalid requests) instead of displaying one generic failure for every case. Internal provider payloads and stack traces are never shown to users.

## Accuracy and source handling

The system prompt directs Sarvam to distinguish facts from estimates, ask clarifying questions when ambiguity matters, use official sources for technical questions, and avoid claiming live verification without search. Tavily snippets are treated as untrusted data; webpage instructions are never followed. When search is used, the final answer is instructed to cite actual returned URLs and publication dates.

See AGENTS.md for implementation constraints, cancellation behavior, privacy rules and the future Guest Mode/group roadmap.
