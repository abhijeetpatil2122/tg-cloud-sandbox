# AGENTS.md — RichDocsBot

## Mission
`@RichDocsBot` is a Telegram Serverless inline bot for searching the official Telegram Bot API documentation. Phase one uses https://corefork.telegram.org/bots/api.json. Error-reference search from errors.json is phase two; do not mix it into phase one.

## Runtime and deployment rules
- This is a Telegram Serverless project, not a Node server. Runtime modules under tgcloud/ execute in Telegram's V8 isolates.
- Use only the built-in sdk modules at runtime. Import project modules by relative paths ending in .js. Do not depend on Node built-ins or third-party runtime packages.
- Each update type has its own tgcloud/handlers/<update_type>.js default export. Inline queries belong in handlers/inline_query.js.
- Use api.answerInlineQuery for inline results. A selected result must use input_message_content: { rich_message: { blocks: [...] } } so the delivered documentation is a native Rich Message, not plain text.
- Follow current Bot API schema/docs for method parameters and Rich Message block shapes. Rich block text can be plain strings or InputRichText objects/arrays.
- Cache fetched API JSON in module scope as a best-effort warm-isolate cache. Never assume an isolate remains alive; handle fetch/JSON errors and return a graceful inline result.
- Never commit bot tokens or .tgcloud/ state. GitHub Actions uses a per-bot secret; never print or expose it.

## Source and search design
- Treat the live OpenAPI JSON as the source of truth. Index operations from paths, request parameter schemas from requestBody, and objects from components.schemas.
- Search should find methods (sendMessage), parameters (chat_id), types/objects (ChatMember), and related descriptions. Prefer direct name matches, then prefixes, then description/token matches.
- Render useful native Rich Messages: title, summary, parameter/field tables, return types, related types, and official documentation links.
- Return at most 50 inline results per page and implement Telegram pagination with `next_offset`; parse the incoming inline query `offset` as the next page position. With an empty query, show a concise usage guide first, followed by popular default documentation articles.
- Convert hyperlinks from the live schema and documentation references into inline Rich Message buttons using the supported RichTextButton shape and a valid URL button style; preserve whitespace around link spans. Make referenced schema types clickable in type cells; do not link parameter or field names back to the parent method/type when that link adds no information.
- Render method descriptions as `expandable_blockquote` Rich Message blocks; keep other descriptions as paragraphs unless intentionally changed.
- Resolve primitive schema aliases (including union aliases such as `ChatId`) into their real primitive types, and never link scalar aliases to object anchors. Only link references that resolve to documented object/union schemas.
- Exact method/type queries (e.g. `sendMessage`, `ChatMember`) show the overview first and other matching method/type names when relevant, without mixing in child parameter/field articles. Method overview articles retain their complete parameter table.
- A trailing dot (e.g. `sendMessage.`, `ChatMember.`) returns the parent’s children as separate articles. A single field query (e.g. `sendMessage.text`, `ChatMember.status`) returns only that field article. Comma-separated field queries (e.g. `sendMessage.text,parse_mode`, `User.id,first_name,username`) return one compact article/table with only the requested fields.
- Individual parameter/field articles must not repeat their description as a separate introductory paragraph when it already appears in the table. Multi-field article titles list the actual selected field names. Include row-count captions on all documentation tables. After a divider, place one dynamic official-documentation link in a minimal source footer, without bot branding. Avoid duplicate documentation links and search instructions inside documentation articles.
- Do not arbitrarily truncate parameter/field lists. Empty inline queries show a help result and all method articles, paginated in pages of up to 50. Use scoped child articles and Telegram inline pagination to make every entry accessible.
- Keep personal caching. Do not add a database migration unless it is deliberately designed and the deployment workflow is updated to apply it safely.
- Phase one is Bot API documentation only. Do not add errors.json search until explicitly requested.

## Validation
- Run node --check on every deployable .js module.
- Test query parsing/ranking, schema resolution, and Rich Message construction against representative queries.
- Validate package.json and tgcloud.jsonc, and validate workflow shell blocks when editing the shared workflow.
- Do not deploy automatically unless the user explicitly asks or confirms the tested implementation is ready.

## Official references
- Serverless guide: https://core.telegram.org/bots/serverless
- Bot API docs: https://core.telegram.org/bots/api
- OpenAPI JSON: https://corefork.telegram.org/bots/api.json
- Inline mode: https://core.telegram.org/bots/inline
- Rich Message formatting: https://core.telegram.org/bots/api#rich-message-formatting-options
- Runtime notes: docs/tgcloud-sdk.md
