# RichDocsBot

RichDocsBot is an inline Telegram Bot API documentation search bot running on Telegram Serverless.

## Inline search
- @RichDocsBot sendMessage — find a Bot API method.
- @RichDocsBot chat_id — find methods that use a parameter.
- @RichDocsBot ChatMember — find API objects and types.

With an empty query, the first result is a compact usage guide, followed by popular default documentation articles. Search results are paginated at up to 50 articles per page using Telegram's `next_offset` mechanism.

Selecting a result inserts its documentation as a native Telegram Rich Message, with headings, linked type references, tables, parameter/field descriptions, return types, and a link to the official reference. Markdown and HTML links present in schema descriptions are preserved where available.

## Commands
- `/start` — welcome message.
- `/help` — command menu and short descriptions.
- `/howtouse` — step-by-step inline-search tutorial.
- `/about` — information about RichDocsBot.

## Data source
The bot reads the current OpenAPI schema from https://corefork.telegram.org/bots/api.json. The parsed index is cached for ten minutes within a warm Serverless isolate and refreshed after the cache expires. Error-reference search using errors.json is intentionally out of scope for phase one.

## Project files
- tgcloud/handlers/inline_query.js — answers inline searches.
- tgcloud/handlers/message.js — /start, /help, /howtouse, and /about.
- tgcloud/lib/docs.js — schema loading, search ranking, and Rich Message rendering.
- AGENTS.md — project-specific coding and deployment rules.

## Deployment
Deploy through the shared tg-cloud-sandbox GitHub Actions workflow using bot_path=bots/RichDocsBot, this bot's numeric Serverless app ID, and mode=deploy. The workflow selects TGCLOUD_TOKEN_RICHDOCSBOT for this folder. Never commit .tgcloud/ state or any token.
