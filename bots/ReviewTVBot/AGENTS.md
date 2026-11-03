# ReviewTVBot — Project Instructions

## Mission and governing rules
Build `@ReviewTvBot` as a Telegram BotFather Serverless bot for private review submissions and direct publishing to one configured Telegram forum supergroup. The user selects a category first, completes a guided review form, previews it, and explicitly confirms publication. There is no admin approval queue.

The repository root `/AGENTS.md` is authoritative for shared Serverless, GitHub workflow, migration, and deployment rules. Read it before every task. Keep all project-specific code and configuration inside `bots/ReviewTVBot/`. Never change unrelated bots.

## Confirmed product decisions
- Destination: one Telegram forum-enabled supergroup.
- Topics: category topics, not individual title topics.
- Publishing: immediately after the author's final confirmation.
- The owner creates the supergroup, enables Topics, adds the bot as admin, creates the topics, and configures their topic IDs.
- The bot must not create topics automatically in the initial release.
- Users submit in private chat; reviews are published to the matching configured topic.
- No external movie metadata provider or Mini App is required for the MVP.

## Category/topic registry
Use these six initial categories in this order:

| Stable key | Forum topic | Coverage |
|---|---|---|
| `hollywood_movies` | Hollywood Movies | Hollywood / English-language cinema |
| `bollywood_movies` | Bollywood Movies | Hindi-language Bollywood cinema |
| `south_indian_movies` | South Indian Movies | Tamil, Telugu, Malayalam, Kannada cinema |
| `other_regional_movies` | Other Regional Movies | Marathi, Bengali, Punjabi, and other regional cinema |
| `tv_shows` | TV Shows & Series | Television shows, web series, streaming originals |
| `anime` | Anime | Anime films and series |

Keep genres (action, comedy, thriller, romance, horror, sci-fi, etc.) separate from forum categories. Do not add genre topics by default. Category keys are stable internal identifiers; labels and Telegram topic IDs must be configurable independently. Never hardcode topic IDs in publishing logic.

## User experience
Commands:
- `/start`: welcome and main menu.
- `/review`: start a review.
- `/myreviews`: show only the requesting user's published reviews, newest first, with links where available.
- `/help`: instructions and review guidelines.
- `/cancel`: cancel the active draft.

Submission flow:
1. Select category using inline buttons.
2. Enter title.
3. Enter release year.
4. If category is TV Shows & Series, ask for an optional season number with Skip. Do not ask for season for movies. Anime series season/cour may be optional metadata, never a blocker.
5. Select rating from 1–10.
6. Enter review text.
7. Optionally upload a poster (or Skip).
8. Choose whether the review contains spoilers.
9. Show a complete preview with Publish, Edit, and Cancel actions.
10. Edit individual fields without losing the rest of the draft.
11. Publish only after an explicit confirmation callback.
12. Confirm success and return the published message link if available.

The chosen category determines the destination topic. Users never enter topic IDs.

## Review post format
Use a consistent, clean layout: category/title heading, release year and optional season, rating as N/10, review body, spoiler-protected text when marked, reviewer attribution, and optional poster. Prefer native Telegram Rich Message formatting after verifying the exact current Bot API input schema. Do not assume ordinary Markdown is automatically parsed as Rich Message or that `sendRichMessage` accepts media. If poster and formatted review need separate messages, send both to the same `message_thread_id`, store both message IDs, and implement partial-failure recovery.

Escape/safely construct user text so it cannot inject Rich Message formatting or links. Spoiler text must actually be protected; a warning label alone is insufficient.

## Forum setup and owner controls
After `/connect`, configure topics by sending `/settopic <category_key>` from inside each matching forum topic. The handler reads `message.message_thread_id` from that command update and stores it against the selected category. This avoids manually copying numeric topic IDs.

Suggested owner-only commands:
- `/connect`: connect/verify the current forum supergroup.
- `/settopic <category>`: configure a category's topic ID using a documented topic-context flow.
- `/settings`: show destination and per-category setup status.
- `/stats`: private owner-only aggregate statistics.
- `/disconnect`: disable publishing after confirmation.

Validate that the destination is a supergroup with forum topics enabled and that the bot has the permissions required to send text and media. Verify each configured topic belongs to the connected group. Do not invent an API method for retrieving topic IDs; inspect current update fields and Bot API methods. If needed, capture `message_thread_id` from a documented update generated inside the target topic.

Owner bootstrap for the initial single-forum setup is based on Telegram's authoritative group creator identity: `/connect` is accepted only when the caller's `from.id` matches the `creator` returned by `getChatAdministrators` for that supergroup. Persist that creator ID as the configured owner. Never let an arbitrary first caller or an ordinary administrator become owner. Check the persisted owner ID server-side on every later admin action; hiding commands from help is not authorization.

## Proposed runtime layout
Adapt to the actual current official scaffold. Keep only modules that are used:
- `tgcloud/handlers/message.js`: commands and incoming text/media.
- `tgcloud/handlers/callback_query.js`: wizard buttons, edits, confirmation.
- `tgcloud/handlers/my_chat_member.js`: permission/membership changes if needed.
- `tgcloud/schema.js`: database tables.
- `tgcloud/lib/config.js`: category registry and config constants.
- `tgcloud/lib/database.js`: database access helpers.
- `tgcloud/lib/sessions.js`: persisted wizard state and expiry.
- `tgcloud/lib/submissions.js`: draft validation and state transitions.
- `tgcloud/lib/publishing.js`: forum topic routing and sends.
- `tgcloud/lib/formatting.js`: preview and Rich Message construction.
- `tgcloud/lib/permissions.js`: owner and forum permission checks.

Runtime code is executed in Telegram's isolated JavaScript V8 runtime, not Node.js. Use only documented built-in SDK imports/APIs such as `sdk` and `sdk/db`. No Node built-ins, arbitrary npm runtime dependencies, persistent processes, timers, or local filesystem assumptions. Internal imports must be relative and include `.js`; handler directories remain flat. Confirm handler signatures and every SDK/Bot API method against current official docs before implementation.

## Logical data model
Plan for:
- users: Telegram ID and minimal display metadata/timestamps.
- community_config: one connected forum chat ID/title/enabled status and trusted owner ID.
- category_topics: category key, forum chat ID, topic ID, configured timestamp.
- reviews: review ID, author ID, category, title, year, optional season, rating, text, optional Telegram poster file ID, spoiler flag, status, timestamps, published message IDs/link.
- drafts/user_sessions: user ID, current step, draft payload, expiry/update timestamps.
- Optional aggregate counters for owner stats; avoid storing raw activity unnecessarily.

Use documented `sdk/db` schema/query APIs and appropriate integer handling for Telegram IDs. Validate relationships in application code where necessary. Drafts are user-scoped and persist across update invocations. No background timer assumptions.

Publishing states should include `draft`, `publishing`, `published`, and `failed`. Validate immediately before sending; prevent duplicate callback processing and concurrent publish attempts. Store each sent message ID as soon as known. If a multi-message publish partially succeeds, record that state and recover without blindly duplicating successful sends. Schema deployment does not apply migrations. Never run `npx tgcloud migrate` without explicit approval after reviewing the proposed migration.

## Security, privacy, and abuse prevention
- Every admin action is checked against trusted owner identity on the server.
- Users can access only their own drafts and review history.
- Validate category, title, year, rating, season, text length, and media type/size.
- Treat all incoming update/callback fields as untrusted.
- Accept Telegram photo uploads for posters; do not fetch arbitrary user-supplied URLs in MVP.
- Apply reasonable per-user draft limits and duplicate-submit protection.
- Expire/clean drafts through normal supported mechanisms; do not depend on timers.
- Return human-readable errors; never expose raw exceptions, credentials, or internal platform errors.
- Store only data required for review publication and history.

## Implementation roadmap
### Phase 1 — Repository/project setup (completed)

### Phase 1 — Repository/project setup
- Use the current official `npm create @tgcloud/bot ReviewTVBot` scaffold.
- Inspect generated files and preserve current CLI conventions.
- Put project at `bots/ReviewTVBot/`.
- Add this `AGENTS.md` and a user-facing `README.md`.
- Add the dedicated token mapping to the manual workflow.
- Keep automatic deployment disabled until the first deployment and live tests are verified.
- Validate structure and syntax; no deployment.

### Phase 2 — Forum configuration (code deployed; database migration and live setup pending)
- Establish trusted owner identity from the Telegram group creator verified during `/connect`.
- Connect and validate the forum supergroup and bot administrator status.
- Configure/verify all six category topic IDs.
- Implement owner-only settings and diagnostics.

### Phase 3 — Database and wizard
- Design schema and review it before migration.
- Persist drafts/sessions.
- Implement category-first wizard and all review fields.
- Add cancellation, validation, and recoverable navigation.

### Phase 4 — Preview/edit
- Preview using the same renderer as publication.
- Allow field edits and return to preview.
- Require explicit confirmation.

### Phase 5 — Publishing
- Implement Rich Message renderer from verified API shapes.
- Route by category using configured topic IDs.
- Handle optional poster and multi-message publishing.
- Add state/idempotency safeguards and persist message IDs/links.

### Phase 6 — Member and owner features
- Implement `/myreviews`, help, settings, stats, connect/disconnect.
- Add clear operational error handling.

### Phase 7 — Test and production
- Test state transitions, multi-user isolation, validation, callback replay, partial failures, permissions, and topic routing.
- Run syntax checks and review CLI status/diff.
- Obtain explicit approval for migration and first deployment.
- Live-test in Telegram.
- Consider auto-deploy only after a stable first release and explicit approval.

## Test checklist
- Every category routes to exactly its configured topic.
- Missing/invalid topic mapping blocks publication clearly.
- Non-owners cannot use admin commands.
- Only forum-enabled supergroups with sufficient bot permissions can connect.
- User A cannot view/edit User B's draft or history.
- Draft survives separate update invocations.
- Invalid field values and unsupported media are rejected cleanly.
- Cancel/edit never publishes accidentally.
- Replayed confirmation does not create duplicate posts.
- Spoilers remain protected.
- Poster and review text target the same topic.
- Partial publish failures are recoverable.
- `/myreviews` is correctly scoped to the requester.
- Every runtime JS module passes `node --check`.
- No token, `.tgcloud/`, `node_modules/`, `.env`, or local state is committed.

## Deployment
- GitHub Actions secret: `TGCLOUD_TOKEN_REVIEWTVBOT`.
- Manual workflow path: `bots/ReviewTVBot`.
- Verified Serverless app ID: `8789022672`.
- GitHub Actions secret: `TGCLOUD_TOKEN_REVIEWTVBOT`.
- Manual workflow path: `bots/ReviewTVBot`.
- Automatic deployment is enabled on `main` for deployable changes under this project. Pull requests validate only; they do not deploy.
- Automatic deployment never applies database migrations. Review and explicitly authorize migrations separately.
- Status is not deployment. Never deploy or migrate without explicit authorization.

## Official references
- https://core.telegram.org/bots/serverless.md
- https://core.telegram.org/bots/api.md
- https://core.telegram.org/bots/api.json.md
- https://core.telegram.org/bots/api-changelog.md
