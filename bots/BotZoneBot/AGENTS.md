# Telegram Mini App Demo — AI Coding Notes

- This project runs on Telegram BotFather Serverless using `@tgcloud/cli` 0.2.x.
- The Mini App frontend is React + Vite; source lives in `src/`, and the production build is `dist/`.
- `tgcloud.jsonc` configures native static hosting from `dist/`. The hosted URL is printed by `npx tgcloud push`.
- Backend runtime modules live only under `tgcloud/`: `handlers/`, `endpoints/`, `lib/`, and `schema.js`.
- Endpoint files are flat within `tgcloud/endpoints/`; each exports a default async function `(input, ctx)`.
- Use `ctx.initData.user` for trusted Telegram identity. Never authorize using frontend-provided user IDs or `initDataUnsafe`.
- Frontend calls endpoints using `Telegram.WebApp.Serverless.call(name, input, callback)`; never put tokens in frontend code.
- Runtime modules may import only the built-in `sdk` modules and project-relative modules ending in `.js`. Do not use Node built-ins or arbitrary npm dependencies in runtime code.
- Database changes must be reviewed and migrated separately. Never add automatic migrations to CI.
- A full `npx tgcloud push` mirrors local modules and static files to the cloud, including deletions. Inspect `npx tgcloud status`/diff before deploying.
- The shared GitHub Actions secret is `TGCLOUD_TOKEN`; never print, hardcode, or commit it.
- Validate runtime JavaScript with `node --check`; validate the frontend with `npm run build`.
