# Repository Guide for AI Agents

## Purpose and source of truth

This repository, `abhijeetpatil2122/tg-cloud-sandbox`, is a shared workspace for multiple Telegram BotFather Serverless projects. Each bot is isolated in its own directory under `bots/`.

Before changing code, read this file, the root `README.md`, the selected bot's `AGENTS.md` and `README.md` (if present), and the current workflow files under `.github/workflows/`. Bot-specific instructions take precedence for that bot; never assume one bot's behavior or requirements apply to another.

## Architecture: Telegram Serverless is not Vercel Functions

- Bot code is deployed to **Telegram BotFather Serverless** using Telegram's official `tgcloud` CLI.
- Runtime handlers execute in Telegram's JavaScript V8-isolate environment. This is not a long-running Node.js server and is not a Vercel deployment.
- In runtime modules, use Telegram's built-in `sdk` imports and supported Serverless APIs. Do not assume Node built-ins, arbitrary installed npm packages, a persistent local filesystem, background processes, or a permanently warm isolate are available at runtime.
- `package.json` and npm dependencies are used by the **build/deployment runner** to install the CLI. They do not mean arbitrary packages can be imported in Telegram's runtime.
- Vercel may be used by a separate website or external API in a bot's architecture, but Vercel does not deploy these Telegram Serverless handlers. Do not introduce Vercel configuration or deployment steps unless the specific project actually requires them.
- Official Serverless documentation: https://core.telegram.org/bots/serverless

## Repository layout

- `bots/NAME/`: one self-contained Telegram Serverless CLI project.
- `bots/NAME/tgcloud/`: runtime modules, handlers, libraries, endpoints and schema.
- `bots/NAME/package.json`: project scripts and CLI dependency.
- `bots/NAME/tgcloud.jsonc`: Telegram Serverless configuration, including optional native static Mini App hosting from a build folder such as `dist/`. The same host serves backend endpoints under `/api/`.
- `bots/NAME/AGENTS.md`: bot-specific rules and feature architecture.
- `.github/workflows/tgcloud.yml`: manual status/deployment workflow.
- `.github/workflows/tgcloud-auto-deploy.yml`: push-triggered automatic deployment workflow.
- `README.md`: user-facing setup and operations summary.

Never commit `node_modules/`, `.tgcloud/`, credentials, tokens, `.env`, or other local state.

## Deployment model

### Manual deployment

Use **Actions → Telegram Serverless CLI → Run workflow** in GitHub. Select `main`, set the exact bot path and its numeric app ID, and run `status` first. Choose `deploy` only when intentionally publishing the selected bot.

The manual workflow checks the project layout, installs the CLI, runs `node --check` on deployable JavaScript modules, validates that the CLI token's `app<id>:` prefix matches the selected app ID, fetches remote state, checks status, and then pushes only selected JavaScript modules. It is designed to avoid a full-project mirror operation that could remove unrelated cloud modules.

### Automatic deployment

Automatic deployment is handled separately by `.github/workflows/tgcloud-auto-deploy.yml`.

- It runs on pushes to `main` when paths under `bots/**` are changed.
- It further filters the commit diff so bot documentation-only changes do not deploy. Changes under a bot's `tgcloud/` directory or to that bot's `package.json`, `package-lock.json`, or `tgcloud.jsonc` are deployable; when `tgcloud.jsonc` configures static hosting, frontend/build files outside documentation are also treated as deployable.
- The workflow uses an explicit bot registry (path, app ID, secret mapping, and `auto_deploy` flag). A bot is not auto-deployed unless its registry entry explicitly enables it.
- **Current rollout:** `bots/RichDocsBot` is enabled for auto-deploy with app ID `8626465761` and Actions secret `TGCLOUD_TOKEN_RICHDOCSBOT`. `bots/BotZoneBot` is enabled for auto-deploy with app ID `8747772496` and Actions secret `TGCLOUD_TOKEN`; its deployment is gated by CI validation and token/app ID matching.
- The workflow validates changed projects (including a frontend build when `tgcloud.jsonc` configures static hosting), validates JavaScript syntax and token/app ID matching, fetches remote state, checks status, and deploys the selected project. For a static Mini App project, it builds the frontend and uses a full `tgcloud push` to publish static assets and modules together. That full push mirrors the local module set to the cloud, including deletions. Non-static bots continue using a targeted module push.
- Changes to root docs or workflow files alone do not trigger bot deployment. Only commits to `main` trigger the push workflow; edits in chat or uncommitted local changes never deploy.
- A bot added in the future remains manual-only until it is explicitly registered in the automatic workflow and its app ID and dedicated secret are verified.
- Automatic deployment does **not** run database migrations. Schema migrations remain a separate, deliberate, reviewed operation. Static Mini App assets are built and deployed with the bot only for projects whose `tgcloud.jsonc` configures a `static` source.

When modifying either workflow, preserve token secrecy, exact app ID validation, per-bot isolation, JavaScript syntax validation, and concurrency protection. Never echo a token or place it in a file/commit. Never make auto-deploy depend on a token or app ID supplied by an untrusted pull request.

## Mini App frontend and backend

Telegram Serverless added native Mini App hosting and authenticated endpoints in CLI 0.2.0. A Mini App can live in the same bot project as its handlers and backend; Vercel is not required for this architecture.

- Frontend source stays at the bot project root (for example, Vite's `src/` and `index.html`) and builds to `dist/`.
- `tgcloud.jsonc` must declare `"static": { "source": "dist", "spa": true }` for a Vite single-page app.
- Backend endpoint modules live in `tgcloud/endpoints/`; `tgcloud/endpoints/getProfile.js` is called as `POST /api/getProfile`.
- The frontend uses the official Telegram Web App script and `Telegram.WebApp.Serverless.call('getProfile', input, callback)`. The platform validates Mini App init data before running endpoints; use `ctx.initData.user` as the trusted identity and never trust browser-supplied user IDs or `initDataUnsafe` for authorization.
- A full `npx tgcloud push` deploys both modules and the configured static build output. It mirrors local modules to the cloud, including deletions; inspect `status`/diff before deploying. Build first (`npm run build`); `push` does not run the frontend build.
- The hosted URL is printed by the CLI as `https://app<app_id>.tgcloud.ai/`. Configure that URL in BotFather's Menu Button or Main Mini App settings.
- SQLite schema changes are deployed as module definitions but are not applied to the database until a separate, reviewed `npx tgcloud migrate` operation. Never run migrations automatically in CI.
- Serverless runtime modules can import only the built-in `sdk` modules and project-relative `.js` modules; React/Vite dependencies are build-time frontend tools, not runtime imports.

## One-time setup for a new bot

1. Create the bot's directory under `bots/` using the official Telegram scaffold and include its project-specific `package.json`, `tgcloud.jsonc`, `tgcloud/` and documentation.
2. Keep `.tgcloud/` and `node_modules/` out of Git.
3. In BotFather, enable Serverless and obtain the bot's CLI access token from **Serverless → CLI Access**. This is not the ordinary Telegram Bot API token.
4. Add the CLI token as a repository Actions secret dedicated to that bot.
5. Add the bot path and exact numeric app ID to the manual workflow's explicit secret mapping.
6. Run the manual workflow in `status` mode first; verify the app ID and remote state before the first deployment.
7. Leave automatic deployment disabled by default. Enable it only after the bot is tested, the secret is confirmed, and its registry entry is added to `tgcloud-auto-deploy.yml`.
8. If the bot includes a Mini App, configure `tgcloud.jsonc` with its static build folder (for example `dist`) and ensure `package.json` has a working `build` script. The workflow builds and full-pushes static projects; review carefully because a full push mirrors deletions. Database migrations remain manual.

## Safe development workflow

1. Inspect the current source and the bot-specific instructions before editing.
2. Make the smallest focused change and preserve working behavior.
3. Validate every changed deployable JavaScript file with `node --check`. For workflow edits, inspect the complete YAML and validate shell blocks.
4. Test parsing, runtime assumptions and relevant edge cases where feasible.
5. Inspect the diff and verify that no credentials or local state are included.
6. Report the commit SHA, changed files, checks performed, and whether a Telegram deployment actually ran. A successful GitHub commit is not proof that the bot was deployed or tested in Telegram.
7. Do not run `tgcloud push`, database migrations, or any manual production deployment unless the user explicitly requests or confirms it. Automatic deployment of eligible RichDocsBot commits to `main` is the intentional exception documented above.

## Useful official references

- Telegram Serverless: https://core.telegram.org/bots/serverless
- Telegram Bot API: https://core.telegram.org/bots/api
- Telegram Mini Apps: https://core.telegram.org/bots/webapps
- GitHub Actions workflow syntax: https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions
