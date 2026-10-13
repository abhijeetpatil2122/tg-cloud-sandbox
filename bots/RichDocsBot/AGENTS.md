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
- Preserve Markdown/HTML links from the live schema as Rich Text URLs, including spaces around link spans. Make referenced schema types clickable in type cells; do not link parameter or field names back to the parent method/type when that link adds no information.
- Methods and types should be overview articles, with parameters/fields exposed as individual inline articles with a one-row table. Query `sendPoll` lists the method and its parameter articles; `sendPoll.*` lists all its parameters; `sendPoll.question` filters to one parameter. Apply the same grammar to types, e.g. `ChatMember`, `ChatMember.*`, and `ChatMember.status`.
- Do not arbitrarily truncate parameter/field lists at 18 rows. Use scoped child articles and Telegram inline pagination (maximum 50 results per response) to make every entry accessible.
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
