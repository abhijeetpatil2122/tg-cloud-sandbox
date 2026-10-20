# Rich Message Editor — Serverless project notes

- This project is the migrated RichEditor Mini App and runs on Telegram BotFather Serverless.
- Keep the original React/Vite UI behavior intact unless a change is explicitly requested.
- The frontend source is under `src/`; Vite builds static output to `dist/`.
- The app is hosted with `tgcloud.jsonc`; runtime modules live under `tgcloud/`.
- Endpoints under `tgcloud/endpoints/` must be flat and export a default async function `(input, ctx)`.
- Telegram validates Mini App init data before invoking an endpoint. Use `ctx.initData.user` as the trusted identity; never authorize from a client-supplied ID or `initDataUnsafe`.
- Use `Telegram.WebApp.Serverless.call(name, input, callback)` for backend calls from the frontend.
- Use `import { api, InputFile, EndpointError } from 'sdk'` and other documented SDK modules. Never use Node built-ins or arbitrary npm packages in runtime code.
- Internal imports between runtime modules must be relative and include `.js`.
- `tgcloud/lib/validateBlocks.js` is the defensive validator for Rich Message blocks. Keep it aligned with the editor's builder.
- Saved chats remain in Telegram CloudStorage. No application-owned SQLite schema is currently required.
- Media uploads use `InputFile` and return Telegram file IDs; previews use the SDK's `api.getFileContent`.
- The app ID is `8747772496`; the existing Actions secret is `TGCLOUD_TOKEN`. Never expose credentials.
- Validate all runtime modules with `node --check` and run `npm run build`.
- A full `npx tgcloud push` mirrors the local module set and static build to the cloud, including deletions. Check `npx tgcloud status`/diff before intentional deployment.
- Never run `npx tgcloud migrate` automatically. If a future feature adds a database schema, review migrations separately and request explicit authorization.
