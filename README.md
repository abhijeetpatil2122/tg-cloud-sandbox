# Telegram Cloud Sandbox

A multi-project workspace for building and operating Telegram BotFather Serverless bots and, where needed, native Mini Apps with backend endpoints. Each bot is an independent project under `bots/`; the repository workflows provide manual status/deploy operations and opt-in automatic deployment.

## Start here

- **[AGENTS.md](./AGENTS.md)** — repository-wide operating plan for AI agents. It is intentionally generic and explains project layout, Serverless constraints, secrets, both workflows, deployment safety, and the new-bot checklist.
- `bots/<BotProject>/` — isolated bot project, with its own `package.json`, `tgcloud.jsonc`, `tgcloud/` runtime modules, and project-specific documentation.
- [Manual workflow](./.github/workflows/tgcloud.yml) — run a status check or intentionally deploy one selected project.
- [Auto-deploy workflow](./.github/workflows/tgcloud-auto-deploy.yml) — validate and deploy eligible changes on `main` for projects explicitly registered for auto-deploy.
- Each project may also have its own `AGENTS.md` and `README.md`; read those before changing that project.

Do not copy a project's `.tgcloud/` local state, CLI credentials, `node_modules/`, or secrets into Git. Keep each bot's code, dependencies, configuration, database schema, and product behavior isolated.

## Current projects

| Project | Purpose | Serverless app ID | Actions secret | Auto-deploy |
|---|---|---:|---|---|
| `bots/BotZoneBot` | React/Vite Rich Message Editor Mini App with Serverless endpoints and Telegram CloudStorage | `8747772496` | `TGCLOUD_TOKEN` | Enabled on `main` |
| `bots/RichDocsBot` | Inline search for Bot API methods/types and related error documentation, rendered as native Rich Messages | `8626465761` | `TGCLOUD_TOKEN_RICHDOCSBOT` | Enabled on `main` |
| `bots/IdPullBot` | Telegram message inspector with private chunked reports, guest-mode Telegraph links, share keyboard, and aggregate stats | `8288436618` | `TGCLOUD_TOKEN_IDPULLBOT` | Manual-only during initial verification |

IdPullBot remains manual-only until its first deployment and live Telegram behavior are verified.

These entries describe the current workflow configuration, not defaults for future projects. A newly added project must remain manual-only until its token/app ID, project validation, and first intentional deployment have been checked and its auto-deploy registry entry is deliberately enabled.

## One-time setup and secrets

For each bot, get a **Serverless CLI access token** from BotFather → the bot → Serverless → CLI Access. The token has the form `app<id>:<secret>`; it is not the ordinary Bot API token. Keep it in GitHub repository **Settings → Secrets and variables → Actions → Repository secrets**. Never commit tokens, paste them into chat/issues, print them in logs, or put them in frontend code.

For new projects, use the secret naming convention `TGCLOUD_TOKEN_<BOT_DIRECTORY_UPPERCASE>`, replacing non-alphanumeric characters in the directory name with underscores. Example: `bots/ExampleBot` → `TGCLOUD_TOKEN_EXAMPLEBOT`.

**Adding a secret alone is not enough.** Both workflows use explicit secret-selection expressions. Add the new path-to-secret mapping to `.github/workflows/tgcloud.yml`; if and when automatic deployment is approved, also add the project path, exact app ID, secret mapping, and `auto_deploy: true` to the registry in `.github/workflows/tgcloud-auto-deploy.yml`, and update every token-selection expression there. Preserve existing live secret names unless a deliberate, verified migration is planned. The workflows check that the token's embedded app ID matches the configured numeric app ID before deploying.

## Manual status check and deployment

1. Open GitHub → **Actions → Telegram Serverless CLI → Run workflow**.
2. Select branch `main` (or the intended reviewed branch).
3. Enter the exact project path directly under `bots/` and its numeric Serverless app ID.
4. Choose `status` first to inspect the selected project's remote state.
5. Choose `deploy` only when you intentionally want to publish that project.

The manual workflow validates the project layout, installs the CLI in the GitHub Actions Node.js runner, checks deployable JavaScript syntax, builds the frontend when `tgcloud.jsonc` configures static hosting, validates the token/app-ID pair, fetches cloud state, and reports status. A successful `status` run does **not** deploy anything.

For projects without static hosting, deployment uses a targeted push of JavaScript modules. For projects with static hosting, it builds the frontend and uses a full `npx tgcloud push` to publish static assets and runtime modules together. A full push mirrors the project's module set to the cloud and can delete remote modules absent locally; review the selected project and CLI status/diff before deploying.

## Automatic deployment

The **Telegram Serverless Auto Deploy** workflow is triggered by pushes to `main` that touch `bots/**`. It detects projects with deployable changes, validates each detected project, checks JavaScript syntax, and builds a configured Mini App frontend. Only projects present in its explicit registry with `auto_deploy: true` are eligible for deployment.

- Both currently listed projects are enabled for automatic deployment; their app IDs and secret names are shown in the table above.
- Documentation-only edits are filtered out. Root-only changes do not match the workflow's `bots/**` trigger.
- Non-static projects use targeted module pushes. Static Mini App projects build their frontend and use a full push, which can delete remote modules absent from the local project.
- Automatic deployment never runs database migrations.
- A push to `main` is not by itself proof that a deployment happened. Check the run's detection output, validation job, project-specific deployment job, final CLI status, and conclusion.

## Native Mini Apps and backend endpoints

A bot may optionally host its compiled Mini App and backend endpoints directly on Telegram Serverless. Configure `tgcloud.jsonc` with a `static.source` matching the real build output (commonly `dist/` for Vite), and make sure `package.json` defines the production build command. The deployed app URL follows `https://app<app_id>.tgcloud.ai/`; use the exact URL reported by the CLI and configure the desired launch surface in BotFather.

Backend endpoints live in `tgcloud/endpoints/` and use the documented `(input, ctx)` signature. The Mini App calls them with `Telegram.WebApp.Serverless.call(name, input, callback)`. Use the platform-verified identity in `ctx.initData` for authorization and ownership checks; never trust a client-supplied user ID or `initDataUnsafe` for authorization. Validate all input on the backend.

## Database and runtime safety

- Serverless backend modules run in Telegram's V8-isolate runtime, not as a persistent Node.js server or Vercel Function. Node.js on a developer machine or CI runner is for CLI/build tooling and does not imply Node built-ins or arbitrary npm packages are available in the Telegram runtime.
- Use supported Serverless SDK imports and APIs. Do not assume persistent processes, a writable persistent filesystem, timers/background workers, or arbitrary runtime packages.
- Each bot has its own SQLite-backed Serverless database and schema. Deploying `tgcloud/schema.js` does not apply database migrations.
- Migrations are separate, reviewed operations. Never run `npx tgcloud migrate` automatically in either workflow; obtain explicit authorization and review proposed changes first.
- Never commit `.tgcloud/`, `node_modules/`, `.env`, credentials, tokens, or other sensitive/local state.

## Adding a new bot

1. Read the root [AGENTS.md](./AGENTS.md) and current official documentation.
2. Scaffold using the current official CLI (typically `npm create @tgcloud/bot <project-name>`) and place the project under `bots/<BotProject>/`.
3. Keep its `package.json`, lockfile where applicable, `tgcloud.jsonc`, `tgcloud/`, frontend source/build config if needed, and project-specific README/AGENTS files together.
4. Exclude `.tgcloud/`, `node_modules/`, credentials, and secrets from commits.
5. Add the new project's Serverless CLI token as a repository Actions secret using the naming convention above.
6. Add the explicit token mapping to the manual workflow and validate the project using its `status` mode.
7. Review the intended push scope and perform the first deployment deliberately. Handle any database migration separately with explicit authorization.
8. Test the bot and Mini App in Telegram; a successful build or deployment is not the same as a live functional test.
9. Only after the project is stable, add its app ID, secret mapping, and deliberate `auto_deploy: true` registry entry to the auto-deploy workflow. Verify the first automatic run.

See [AGENTS.md](./AGENTS.md) for the full operational checklist and rules.

## Official documentation references

Prefer these Markdown endpoints when feeding documentation to AI tools; use the human-readable pages for ordinary browsing.

- **Telegram Serverless (Markdown):** [serverless.md](https://core.telegram.org/bots/serverless.md) · [human-readable page](https://core.telegram.org/bots/serverless)
- **Telegram Mini Apps / WebApp (Markdown):** [webapp.md](https://core.telegram.org/bots/webapp.md) · [human-readable page](https://core.telegram.org/bots/webapps)
- **Telegram Bot API documentation (Markdown):** [api.md](https://core.telegram.org/bots/api.md) · [human-readable page](https://core.telegram.org/bots/api)
- **Telegram Bot API schema/data (Markdown):** [api.json.md](https://core.telegram.org/bots/api.json.md)
- **Telegram Bot API changelog (Markdown):** [api-changelog.md](https://core.telegram.org/bots/api-changelog.md)

For the detailed instructions and repository-specific safety rules, start with [AGENTS.md](./AGENTS.md).
