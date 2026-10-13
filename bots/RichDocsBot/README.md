# RichDocsBot

RichDocsBot is an inline Telegram Bot API documentation search bot running on Telegram Serverless.

## Inline search
- `@RichDocsBot sendPoll` — find a method, followed by separate articles for each parameter.
- `@RichDocsBot sendPoll.*` — list all parameters for a method.
- `@RichDocsBot sendPoll.question` — open one parameter only.
- `@RichDocsBot ChatMember` — find a type, followed by separate articles for each field.
- `@RichDocsBot ChatMember.*` — list all fields for a type.
- `@RichDocsBot ChatMember.status` — open one field only.
- `@RichDocsBot chat_id` — find methods that use a parameter.

With an empty query, the first result is a compact usage guide, followed by popular default documentation articles. Search results are paginated at up to 50 articles per page using Telegram's `next_offset` mechanism.

Selecting a method or type inserts its overview as a native Telegram Rich Message. Parameters and fields are separate results, each with a compact one-row table; this avoids hiding entries behind an arbitrary row limit. Type references and links in the source descriptions remain clickable, while parameter and field names are not unnecessarily linked back to the parent method or type. Text spacing around inline links is preserved.

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
