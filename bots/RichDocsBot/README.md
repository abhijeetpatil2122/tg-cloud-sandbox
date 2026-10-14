# RichDocsBot

RichDocsBot is an inline Telegram Bot API documentation search bot running on Telegram Serverless.

## Inline search
- `@RichDocsBot sendPoll` — find the method and related matching methods, each with its full parameter table.
- `@RichDocsBot sendPoll.` — list all parameters as separate articles.
- `@RichDocsBot sendPoll.question` — open one parameter only.
- `@RichDocsBot sendPoll.question,options` — show only the selected parameters together in one table.
- `@RichDocsBot ChatMember` — show only the type overview.
- `@RichDocsBot ChatMember.` — list all fields as separate articles.
- `@RichDocsBot ChatMember.status` — open one field only.
- `@RichDocsBot ChatMember.id,first_name,username` — show selected fields together in one table.
- `@RichDocsBot chat_id` — find parameters by exact name across methods.

A trailing dot lists children; an explicit field after the dot filters to that field; comma-separated field names create one article containing only the requested rows. Method and type searches do not automatically mix in child articles; matching method/type names can appear as related results.

With an empty query, the first result is a compact usage guide, followed by all methods in alphabetical order. Search results are paginated at up to 50 articles per page using Telegram's `next_offset` mechanism.

Selecting a method or type inserts its overview as a native Telegram Rich Message. Method descriptions use Telegram's expandable blockquote Rich Message block. Hyperlinks, including referenced types, use inline Rich Message buttons. Large method/type tables and multi-field selection tables start collapsed inside native Rich Message details blocks; compact one-row tables remain open. Links inside table cells omit button styling so Telegram uses its app-specific default, while the footer documentation link remains a primary button. Tables retain row-count captions. Primitive schema aliases such as `ChatId` are expanded to their actual types (for example, `Integer | String`) rather than linked to nonexistent documentation anchors. All table kinds have captions, and the source link is included in a minimal footer. Individual parameters and fields have a compact one-row table without a duplicate description paragraph. Multi-field searches show one table with only the requested rows. Type references and links in source descriptions remain clickable, while parameter and field names are not unnecessarily linked back to the parent method or type. Text spacing around inline links is preserved.

## Commands
- `/start` — welcome message.
- `/help` — command menu and short descriptions.
- `/howtouse` — step-by-step inline-search tutorial.
- `/about` — information about RichDocsBot.

## Data source
The bot reads the current OpenAPI schema from https://corefork.telegram.org/bots/api.json. The parsed index is cached for ten minutes within a warm Serverless isolate and refreshed after the cache expires. Error-reference search using errors.json is intentionally out of scope for phase one.

## Code architecture
The implementation is split by responsibility so new data sources can be added without growing one large module:

- `tgcloud/lib/config.js` — shared endpoints, cache duration, pagination limit, and schema type labels.
- `tgcloud/lib/schema-client.js` — fetches and caches the Bot API OpenAPI document; this is the schema data-access boundary.
- `tgcloud/lib/indexer.js` — turns the OpenAPI document into searchable method/type records.
- `tgcloud/lib/schema-utils.js` — resolves references, aliases, and readable type names.
- `tgcloud/lib/search.js` and `search-children.js` — query ranking, scoped field selection, and child articles.
- `tgcloud/lib/rich-text.js` — shared text cleanup, URL normalization, and Rich Message text/button helpers.
- `tgcloud/lib/render.js` — converts search records into native Rich Message blocks, tables, and inline results.
- `tgcloud/lib/docs.js` — small compatibility entry point used by handlers; re-exports the public search/render API.
- `tgcloud/handlers/inline_query.js` — answers inline searches and handles graceful fallback.
- `tgcloud/handlers/message.js` — `/start`, `/help`, `/howtouse`, and `/about` commands.
- `AGENTS.md` — project-specific coding and deployment rules.

Keep external data access, schema indexing, search behavior, and presentation separate. A future errors endpoint should get its own config entry and data-access/indexing module rather than being embedded into the existing Bot API schema client.

## Deployment
Deploy through the shared tg-cloud-sandbox GitHub Actions workflow using bot_path=bots/RichDocsBot, this bot's numeric Serverless app ID, and mode=deploy. The workflow selects TGCLOUD_TOKEN_RICHDOCSBOT for this folder. Never commit .tgcloud/ state or any token.
