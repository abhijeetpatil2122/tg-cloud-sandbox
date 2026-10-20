# Rich Message Editor — Serverless project notes

- Preserve the original React/Vite editor behavior.
- Runtime modules live under `tgcloud/`; imports between runtime modules use relative paths ending in `.js`.
- The runtime SDK is `sdk`; use `sdk/db` for SQLite schema/query helpers. Always await database operations.
- Trust `ctx.initData.user` only in Serverless endpoints; never trust a user ID supplied by the client.
- The schema in `tgcloud/schema.js` creates additive tables for users, chats, media upload chunks/sessions, media upload history, and events.
- `npx tgcloud push` deploys the schema and records pending database changes; it does not apply them. Review migrations and request explicit authorization before running `npx tgcloud migrate`.
- Never remove old database tables automatically. Undeclared tables remain until a separately reviewed migration explicitly deprecates them.
- Media is uploaded in small chunks through Serverless endpoints, then reassembled and sent through the SDK `InputFile` API. Do not put the bot token in the frontend.
- Channel sharing uses a Bot API request-chat keyboard and persists the returned `chat_shared` update only after checking the bot's actual permissions.
- Keep upload sessions private to their authenticated owner and delete temporary chunks after successful completion/cancellation.
- Run `node --check` for every runtime module and `npm run build` before deploying.
