# PWidgetBot — Agent Instructions

## Mission
PWidgetBot is a universal, product-quality Telegram HTML Widget playground and API reference bot. It demonstrates real Bot API 10.4 widget capabilities with practical, interactive examples.

## Runtime rules
- Runs on Telegram Serverless V8 isolates; no Node built-ins, persistent process, filesystem, timers, or arbitrary runtime dependencies.
- Use the built-in `sdk` import and relative imports ending in `.js`.
- Handler files are flat under `tgcloud/handlers/` and export a default function.
- Current update handlers: `message.js`, `callback_query.js`, `widget_query.js`, `shared_widget_query.js`.
- Use `api.sendWidget`, `api.sendSharedWidget`, `api.answerWidgetQuery`, `api.editMessageWidgetData`, and `api.editSharedWidgetData` as documented by the current Bot API.
- Answer every widget query within 15 seconds, including errors. Query answers are text up to 1024 bytes.
- HTML widgets are self-contained, have inline CSS/JS, no network access, no external resources, and must stay within 32 KB uncompressed / 4 KB zlib-compressed. Keep the actual examples comfortably below the limit.
- The widget state is bot-owned. Use `TelegramWidget.chatData` and `TelegramWidget.publicData`; widgets request changes with `TelegramWidget.request(data)`. Never assume the widget can write its own state.
- The production `sendWidget` path currently supports private chats only. Do not present group/channel sending as production-ready.
- Do not assume inline widget results are production-enabled.
- Wallet data is public wallet metadata supplied by Telegram. Never request or store seed phrases, private keys, or recovery phrases. Signing and transaction demonstrations must require explicit wallet approval.

## Architecture
- `lib/catalog.js`: categories and demo metadata.
- `lib/widget_factory.js`: compact, self-contained widget HTML.
- `lib/widget_actions.js`: query validation, demo state transitions, wallet event summaries, and API state updates.
- `handlers/message.js`: commands and home menu.
- `handlers/callback_query.js`: category navigation and demo launch.
- `handlers/widget_query.js`: original widget queries.
- `handlers/shared_widget_query.js`: shared-widget query handling.

## Data and safety
- Do not store raw wallet payloads or signatures. Only display the minimum result needed for the demonstration.
- Parse widget state defensively and enforce the 1024-byte state/query limits.
- Validate action names and numeric inputs; never trust widget-supplied state or user IDs.
- Keep demo state in message `chat_data` or shared `public_data`; no DB schema is required for this stateless first release.
- Handle unsupported widget methods with a concise, user-friendly fallback.
- Do not add this project to auto-deploy until the first manual status check, deployment, and Telegram device tests are complete.

## Validation
- Run `node --check` on all runtime modules.
- Check widget HTML size (both uncompressed and zlib-compressed) with a local Node/Python test before release.
- Test private-chat restrictions, malformed query data, timeout-safe query answers, state edits, and wallet cancellation.
- Never deploy or migrate without explicit authorization.
