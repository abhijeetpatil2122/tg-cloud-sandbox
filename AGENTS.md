# Repository Operating Plan for AI Agents

## 1. Mission and governing principles

This repository is a multi-project sandbox for building, testing, and deploying independent Telegram BotFather Serverless applications. Each bot is a separate project under `bots/`; a bot may be a chat bot, a Mini App with backend endpoints, or a combination.

This file is the repository-wide plan, not documentation for any particular example bot. Keep it generic. Do not treat one project's features, names, app ID, database, frontend stack, or deployment state as requirements for another project.

Before making changes:
1. Read this file and the root `README.md`.
2. Read the selected project's `AGENTS.md`, `README.md`, `package.json`, `tgcloud.jsonc`, and relevant source files when present.
3. Inspect both workflows under `.github/workflows/` before changing deployment or adding a project.
4. Check current GitHub Actions runs and the current branch state when deployment status matters.
5. Confirm the requested scope. Do not change unrelated bots or their deployed behavior.

The authoritative technical reference is the official Telegram Serverless documentation: https://core.telegram.org/bots/serverless. Re-check it when using new platform or CLI capabilities; do not rely on outdated examples from earlier CLI versions.

## 2. Platform model: Telegram Serverless

Telegram Serverless runs bot backend modules on Telegram's infrastructure in an isolated JavaScript V8 runtime. It is not a long-running Node.js process, a VPS, or Vercel Functions.

- Telegram routes supported Bot API updates to matching handler modules. Each invocation runs on demand and then returns.
- Telegram provides the built-in Serverless SDK, Bot API access, outbound HTTP through the supported SDK, and a SQLite-backed database.
- Node.js/npm on a developer machine or GitHub Actions runner is used for tooling, validation, and frontend builds. It does not mean arbitrary npm packages or Node built-ins are available inside Telegram's runtime.
- Never assume a persistent process, local filesystem, timers/background workers, or arbitrary third-party runtime packages. Verify capabilities in the official docs before relying on them.
- Vercel or another external service may be used by a project when its architecture explicitly needs it, but it is not the deployment target for Telegram Serverless modules or native Serverless Mini App hosting.

## 3. Repository and project layout

The repository is a collection of isolated projects, not one shared bot runtime.

```text
/
├── AGENTS.md                         # Generic repository-wide plan
├── README.md                          # Human-facing repository overview
├── bots/
│   └── <BotProject>/
│       ├── AGENTS.md                  # Project-specific AI instructions
│       ├── README.md                  # Project-specific setup and behavior
│       ├── package.json               # Local CLI/build scripts and dependencies
│       ├── package-lock.json          # Commit when maintained by the project
│       ├── tgcloud.jsonc              # Serverless/static-hosting configuration
│       ├── tgcloud/
│       │   ├── handlers/              # Telegram update handlers
│       │   ├── endpoints/             # Mini App backend endpoints (optional)
│       │   ├── lib/                   # Shared runtime modules (optional)
│       │   └── schema.js              # Database schema
│       ├── index.html / src/          # Optional frontend source
│       ├── dist/                      # Optional generated static build output
│       └── docs/                      # Optional project documentation
└── .github/
    └── workflows/
        ├── tgcloud.yml                # Manual status/deploy workflow
        └── tgcloud-auto-deploy.yml    # Push-triggered auto-deploy workflow
```

The exact frontend and documentation layout may vary by project. Keep each project's dependencies, source, configuration, runtime modules, and instructions inside its own directory. Do not share runtime files or credentials between projects unless an intentional shared mechanism is designed and documented.

Never commit `node_modules/`, `.tgcloud/`, CLI credentials, Bot API tokens, secret values, private session files, `.env` files, or other local/generated sensitive state. Respect the repository's existing ignore rules.

## 4. Runtime module rules

All code executed by Telegram Serverless belongs under the project's `tgcloud/` directory.

- `tgcloud/handlers/<update_type>.js`: entry point for a Telegram update type. Add only handlers the bot needs. Handler directories are flat; do not create nested directories under `handlers/`.
- `tgcloud/endpoints/<endpointName>.js`: optional backend functions called by that project's hosted Mini App. Endpoint directories are flat.
- `tgcloud/lib/`: optional shared runtime helpers. Nested directories are allowed here.
- `tgcloud/schema.js`: the project's database table definitions.

Runtime modules should use supported built-in imports such as `sdk`, `sdk/db`, and other documented SDK modules. Internal project imports must be relative, stay within `tgcloud/`, and include the `.js` extension. Do not import Node built-ins, frontend modules, or arbitrary npm packages into runtime code.

Use the exact handler/endpoint signatures and SDK APIs described by the current official docs and the project's local SDK reference (if supplied). Do not invent API methods or assume that an API available in the Bot API is automatically exposed as a direct runtime global.

Each project is isolated: do not copy its handlers, schema, endpoint names, bot-specific environment assumptions, or product logic into another project without a clear request.

## 5. Native Mini App frontend and backend

A Mini App is optional. When a project needs one, its frontend source and build configuration live beside `tgcloud/` in the same bot project. Telegram Serverless can host the compiled frontend and the bot's backend modules together.

- Configure `tgcloud.jsonc` with a `static` source pointing at the actual frontend build directory. For a Vite SPA this is commonly `dist`, with SPA fallback enabled when appropriate.
- Ensure `package.json` defines the correct production build command (for example, `npm run build`). Build output must exist before deploying static files.
- Telegram hosts the deployed app at `https://app<app_id>.tgcloud.ai/`; use the exact URL reported by the CLI. Configure the desired launch surface in BotFather (for example, the Main Mini App or Menu Button) when the project requires it.
- The frontend calls backend endpoint functions by name using the documented `Telegram.WebApp.Serverless.call(...)` API. An endpoint named `getProfile` is exposed as `POST /api/getProfile`.
- Endpoints use the documented `(input, ctx)` signature. The platform validates Mini App init data before invoking a protected endpoint and exposes trusted identity through `ctx.initData`. Use `ctx.initData.user` for authorization and ownership checks. Never authorize a request based on a client-supplied user ID or `initDataUnsafe`.
- Treat all frontend input as untrusted. Validate type, size, permitted values, ownership, and authorization in the backend. Avoid returning secrets or internal exception details to the client.
- The frontend and Serverless runtime are different execution environments: frontend packages are build-time/browser dependencies; runtime modules still follow the restricted SDK-only import rules.

For a static Mini App project, the automatic workflow builds the frontend and uses a full `npx tgcloud push` to publish the static output and runtime modules together. A full push mirrors the project's module set to the cloud, including deletions. Review the selected project and the CLI status/diff carefully before any intentional full push.

## 6. Database and migrations

Each bot project has its own SQLite-backed Serverless database and its own schema module.

- Define tables using the documented `sdk/db` schema DSL in `tgcloud/schema.js`.
- Use the documented asynchronous database API and SDK query helpers. Follow the official schema and query constraints; do not assume a generic ORM or direct SQLite connection is available.
- A schema module deployment does not itself apply schema changes to the database.
- Database migrations are a separate, deliberate operation: inspect the proposed changes and run `npx tgcloud migrate` only after explicit user authorization and review.
- Never add migrations to automatic or manual CI deployment steps. Never assume a newly declared table exists until migration has been applied and verified.
- Be especially careful with destructive changes, renames, drops, and changes that could lose existing data. Explain the impact before proceeding.

## 7. Bot creation and repository secret conventions

When adding a new bot:

1. Obtain/create the Telegram bot and enable **Serverless** in BotFather.
2. Use BotFather → Serverless → CLI Access to obtain the **Serverless CLI access token**. It has a form like `app<id>:<secret>`. It is different from the ordinary Bot API token.
3. Record the exact numeric app ID from that token. Never infer or guess it from a bot username.
4. Scaffold a clean project using the official current CLI, typically `npm create @tgcloud/bot <project-name>`. For an existing frontend, follow the current official instructions for adding Serverless to that folder rather than overwriting the frontend.
5. Place the project directly under `bots/<BotProject>/`, and keep its `package.json`, `tgcloud.jsonc`, `tgcloud/`, and project documentation with it.
6. Commit source and lockfiles as appropriate, but not `.tgcloud/`, `node_modules/`, credentials, or secrets.
7. Add the token to **GitHub repository Actions secrets** (Settings → Secrets and variables → Actions → Repository secrets). Do not store it in a committed file, a public issue, chat, workflow output, or frontend code.
8. For new bots, use the naming convention `TGCLOUD_TOKEN_<BOT_DIRECTORY_UPPERCASE>`; replace non-alphanumeric characters in the directory name with underscores. Example pattern only: directory `bots/ExampleBot` → secret `TGCLOUD_TOKEN_EXAMPLEBOT`.
9. The workflows currently use explicit secret mappings/expressions, not automatic discovery of every repository secret. Adding a secret alone is not enough: update the manual workflow's secret selection and, if auto-deploy is desired, the auto-deploy registry and all token-selection expressions. Preserve any existing secret names until the workflow is deliberately migrated; never rename or remove a live secret casually.
10. Keep the app ID and secret mapping consistent across the manual workflow, auto-deploy registry, and repository secret. The workflow must validate that the token's `app<id>:` prefix matches the configured numeric app ID before deployment.

The secret naming convention above is for new projects. The workflow source is the operational source of truth for which secret is actually read. Inspect it rather than assuming a secret will be discovered from its name.

## 8. Manual GitHub Actions workflow

The workflow `.github/workflows/tgcloud.yml` is the explicit, user-triggered route for status checks and deployment.

Use GitHub → **Actions → Telegram Serverless CLI → Run workflow**:
1. Select the intended branch (normally `main`).
2. Enter the exact project path directly under `bots/`.
3. Enter the exact numeric Serverless app ID associated with that project's CLI token.
4. Select `status` first. Use `deploy` only when intentionally publishing the selected project.

The current workflow validates the project layout, installs dependencies/CLI on a Node.js runner, checks deployable JavaScript syntax, builds the frontend when static hosting is configured, verifies the token/app-ID match, fetches cloud state, and runs `tgcloud status`. In deploy mode it uses a full push for configured static projects, and a targeted module push for projects without static hosting.

Important:
- A successful `status` run is not a deployment.
- The manual workflow only supports projects whose secret mapping has been added to its token-selection expressions. Update those mappings when adding a new project.
- For a full static push, remote modules absent from the local project can be deleted. Review status/diff and the intended project path before deploying.
- A workflow success is not proof that every user-facing behavior was tested in Telegram; distinguish validation, deployment, and live functional testing in reports.

## 9. Automatic deployment workflow

The workflow `.github/workflows/tgcloud-auto-deploy.yml` is separate from the manual workflow.

- It is triggered by pushes to `main` with changes under `bots/**`. Root-only documentation/workflow changes and chat edits do not themselves deploy a bot.
- It computes which bot projects contain deployable changes. Documentation-only changes are filtered out. Runtime changes under `tgcloud/` and project build/configuration changes can trigger validation/deployment. For a configured static Mini App, frontend/build source changes are also deployable.
- The workflow validates changed projects, checks deployable JavaScript syntax, and runs the frontend build when static hosting is configured.
- A separate explicit registry determines each project's directory, app ID, Actions secret mapping, and `auto_deploy` flag. A project is not eligible for automatic deployment merely because it exists in `bots/`.
- To enable a new project, add a registry entry with its exact path, numeric app ID, dedicated secret mapping, and an intentional `auto_deploy: true` setting. Update every secret-selection expression needed by the workflow. Keep new projects manual-only until credentials, app ID, validation, and first deployment have been verified.
- The workflow checks that the configured secret is present and that the token's embedded app ID matches the registry app ID. Do not bypass this validation or print the token.
- Projects without static hosting use a targeted module push. Projects with static hosting build the frontend and use a full push, which mirrors modules and static files and can remove remote modules missing locally.
- Per-project concurrency protection must remain enabled so overlapping runs do not race each other.
- Automatic deployment never runs database migrations.

A commit being pushed to `main` is not enough to guarantee a deploy. Check the workflow run's changed-project detection, validation job, selected project deployment job, final CLI status, and conclusion. Report exactly what succeeded or failed.

## 10. Adding a bot to both workflows: checklist

When a project is ready for its first deployment:

- [ ] Create `bots/<BotProject>/` from the current official scaffold and add project-specific documentation.
- [ ] Verify `package.json`, `tgcloud.jsonc`, and `tgcloud/` are present.
- [ ] Add the project's Serverless CLI token as a repository Actions secret using the new-project naming convention.
- [ ] Add the path-to-secret mapping to `.github/workflows/tgcloud.yml`.
- [ ] Run the manual workflow in `status` mode and verify the app ID and remote state.
- [ ] Validate all runtime modules and build the frontend if present.
- [ ] Perform the first deployment intentionally, after reviewing the push scope.
- [ ] If the project changes the schema, review and request approval for a separate migration.
- [ ] Test the bot and Mini App in Telegram; verify backend authorization and relevant persistence behavior.
- [ ] Only after the project is stable, add its entry to the auto-deploy registry and update secret selection expressions in `.github/workflows/tgcloud-auto-deploy.yml`.
- [ ] Verify the first automatic run, including which project was detected, which deployment path was selected, and the final CLI status.
- [ ] Keep the project's own `AGENTS.md` and `README.md` accurate as its architecture evolves.

Do not enable automatic deployment by default for a newly scaffolded project. Enabling it is an explicit rollout decision.

## 11. Safe change, test, and deployment procedure

For all work in this repository:

1. **Inspect first.** Read the relevant files, local instructions, current git/branch state, and related workflow definitions before editing.
2. **Keep scope narrow.** Preserve unrelated working behavior. Do not refactor other bots or change their secrets/app IDs as collateral work.
3. **Use official APIs.** Confirm unfamiliar Serverless, Bot API, Mini App, and CLI behavior against current official docs.
4. **Validate runtime modules.** Run `node --check` for every changed deployable JavaScript module, and validate all affected modules when practical.
5. **Validate frontend projects.** Install dependencies using the project's lockfile-compatible workflow and run its production build (for example, `npm run build`) when the frontend or build config changes.
6. **Validate workflow edits.** Review the entire YAML and shell commands, especially expressions, path filters, matrix entries, concurrency, secret mapping, app-ID validation, and conditional deploy steps. Never expose secret values in logs.
7. **Review the diff.** Check for accidental deletions, unrelated changes, generated files, local state, and credentials.
8. **Keep production actions deliberate.** Do not run a manual production deployment, `tgcloud push`, or database migration unless the user explicitly requests or confirms it. An eligible auto-deploy triggered by a commit to `main` is the documented exception; warn when a change will trigger it.
9. **Verify outcomes.** Inspect the actual GitHub Actions run and CLI output. Distinguish a commit, a passing validation/build, a successful deployment, a schema migration, and a live Telegram test as separate outcomes.
10. **Report clearly.** Summarize files changed, validation performed, commit/run links where available, deployment status, any migration still needed, and what remains unverified.

## 12. Official references

- Telegram Serverless: https://core.telegram.org/bots/serverless
- Telegram Bot API: https://core.telegram.org/bots/api
- Telegram Mini Apps: https://core.telegram.org/bots/webapps
- GitHub Actions workflow syntax: https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions

When a technical detail may have changed since this plan was written, consult the official documentation before applying it. Keep this root file generic and repository-wide; place project-specific details in that project's own `AGENTS.md` and `README.md`.
