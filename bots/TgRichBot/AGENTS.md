# TgRichBot — production Serverless project notes

- Preserve the original React/Vite editor behavior.
- Runtime modules live under `tgcloud/`; imports between runtime modules use relative paths ending in `.js`.
- The runtime SDK is `sdk`; use `sdk/db` for SQLite schema/query helpers. Always await database operations.
- Trust `ctx.initData.user` only in Serverless endpoints; never trust a user ID supplied by the client.
- Permanent application data in SQLite is limited to each user's saved chats. Temporary upload sessions/chunks support chunked uploads and are cleaned up after completion/cancellation or after 24 hours.
- `npx tgcloud push` deploys the schema and records pending database changes; it does not apply them. Review migrations and request explicit authorization before running `npx tgcloud migrate`.
- Never remove old database tables automatically. Undeclared tables remain until a separately reviewed migration explicitly deprecates them.
- Media is uploaded in small chunks through Serverless endpoints, then reassembled and sent through the SDK `InputFile` API. Do not put the bot token in the frontend.
- Keep upload sessions private to their authenticated owner and delete temporary chunks after successful completion/cancellation.
- Run `node --check` for every runtime module and `npm run build` before deploying.
