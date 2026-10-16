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
- `@RichDocsBot E sendMessage` — search errors associated with a Bot API method.
- `@RichDocsBot E BUTTON_URL_INVALID` — search errors by message or identifier.
- `@RichDocsBot E 429` — browse errors by status code.

Error search uses the separate `https://corefork.telegram.org/bots/errors.json` dataset. The `E` prefix has its own help, search ranking, no-results article, and Rich Message renderer. Method documentation articles include an **Errors** Rich Message button styled `danger` that switches inline mode to `E <methodName>`.

A trailing dot lists children; an explicit field after the dot filters to that field; comma-separated field names create one article containing only the requested rows. Method and type searches do not automatically mix in child articles; matching method/type names can appear as related results.

With an empty query, the first result is a compact usage guide, followed by all methods in alphabetical order. Search results are paginated at up to 50 articles per page using Telegram's `next_offset` mechanism.

Selecting a method or type inserts its overview as a native Telegram Rich Message. Method descriptions use Telegram's expandable blockquote Rich Message block. Hyperlinks, including referenced types, use inline Rich Message buttons. Large method/type tables and multi-field selection tables start collapsed inside native Rich Message details blocks; compact one-row tables remain open. Links inside table cells omit button styling so Telegram uses its app-specific default, while the footer documentation link remains a primary button. Tables retain row-count captions. Primitive schema aliases such as `ChatId` are expanded to their actual types (for example, `Integer | String`) rather than linked to nonexistent documentation anchors. All table kinds have captions, and the source link is included in a minimal footer. Individual parameters and fields have a compact one-row table without a duplicate description paragraph. Multi-field searches show one table with only the requested rows. Type references and links in source descriptions remain clickable, while parameter and field names are not unnecessarily linked back to the parent method or type. Text spacing around inline links is preserved.

## Commands
- `/start` — welcome message.
- `/help` — command menu and short descriptions.
- `/howtouse` — step-by-step inline-search tutorial.
- `/about` — information about RichDocsBot.

## Data source
The bot reads the current OpenAPI schema from https://corefork.telegram.org/bots/api.json and the error catalogue from https://corefork.telegram.org/bots/errors.json. Both indexes are cached for ten minutes within a warm Serverless isolate and refreshed after the cache expires.

## Code architecture
The implementation is split by responsibility so new data sources can be added without growing one large module:

- `tgcloud/lib/config.js` — shared endpoints, cache duration, pagination limit, and schema type labels.
- `tgcloud/lib/schema-client.js` — fetches and caches the Bot API OpenAPI document; this is the schema data-access boundary.
- `tgcloud/lib/error-client.js` — separately fetches, caches, indexes, and searches Bot API error mappings.
- `tgcloud/lib/indexer.js` — turns the OpenAPI document into searchable method/type records.
- `tgcloud/lib/schema-utils.js` — resolves references, aliases, and readable type names.
- `tgcloud/lib/search.js` and `search-children.js` — query ranking, scoped field selection, and child articles.
- `tgcloud/lib/rich-text.js` — shared text cleanup, URL normalization, and Rich Message text/button helpers.
- `tgcloud/lib/render.js` — converts documentation search records into native Rich Message blocks, tables, and inline results.
- `tgcloud/lib/error-render.js` — renders error help, error details, no-results, and fallback articles.
- `tgcloud/lib/docs.js` — small compatibility entry point used by handlers; re-exports the public search/render API.
- `tgcloud/handlers/inline_query.js` — answers inline searches and handles graceful fallback.
- `tgcloud/handlers/message.js` — `/start`, `/help`, `/howtouse`, and `/about` commands.
- `AGENTS.md` — project-specific coding and deployment rules.

Keep external data access, schema indexing, search behavior, and presentation separate. Keep the error catalogue separate from the OpenAPI schema client and index.

## Deployment
The manual deployment workflow is available under Actions → Telegram Serverless CLI. Select `bots/RichDocsBot`, app ID `8626465761`, and mode `status` first; select `deploy` when you intend to publish. RichDocsBot is also enabled for automatic deployment when deployable files are committed to `main`. The auto workflow validates JavaScript syntax and the CLI token's app ID, fetches cloud state, and pushes only this bot's JavaScript modules. Documentation-only changes do not deploy. Database migrations and static Mini App assets are not automatic. The required Actions secret is `TGCLOUD_TOKEN_RICHDOCSBOT`. Never commit `.tgcloud/` state or any token.
