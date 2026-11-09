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
- The forum's built-in General topic is a separate system destination, configured with `/settopic general` from General. Its fixed topic ID is 1; it is not a review category.
- Users submit in private chat; reviews are published to the matching configured topic.
- No external movie metadata provider or Mini App is required for the MVP.

## Category/topic registry
Use these eight review categories in this order:

| Stable key | Forum topic | Coverage |
|---|---|---|
| `hollywood_movies` | Hollywood Movies | Hollywood / English-language cinema |
| `bollywood_movies` | Bollywood Movies | Hindi-language Bollywood cinema |
| `south_indian_movies` | South Indian Movies | Tamil, Telugu, Malayalam, Kannada cinema |
| `other_regional_movies` | Other Regional Movies | Marathi, Bengali, Punjabi, and other regional cinema |
| `international_movies` | International Movies | Non-Hollywood international cinema, including Japanese, Chinese, Korean, European, and other world cinema |
| `tv_shows` | TV Shows & Series | Television shows, web series, streaming originals |
| `k_c_j_dramas` | K/C/J Dramas | Korean, Chinese, and Japanese dramas |
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
4. If category is TV Shows & Series or K/C/J Dramas, ask for an optional series end year and optional season number with Skip. Both categories share the same series metadata flow. Do not ask for season for movies. Anime series season/cour may be optional metadata, never a blocker.
5. Select a numeric rating from 1–10.
6. Optionally select a personal verdict: Absolute Cinema, Go for It, Timepass, or Skip It; allow Skip.
7. Enter review text.
8. Optionally add up to 10 images (Telegram photos or direct HTTPS image URLs) to create a slideshow, or Skip. The bot automatically adds a category-specific slideshow caption; users do not enter captions.
9. Choose whether the review contains spoilers.
10. Show a complete preview with Publish, Edit, and Cancel actions.
11. Edit individual fields without losing the rest of the draft.
12. Publish only after an explicit confirmation callback.
13. Confirm success and return the published message link if available.

The chosen category determines the destination topic. Configure the separate General notification topic with `/settopic general` from General (fixed topic ID 1), and the leaderboard topic with `/settopic leaderboard`; neither is a review category and neither appears in the review category picker. Users never enter topic IDs.
- After a review is successfully published in its category topic, send a compact Rich Message notification to General. Include the title/year, the category's configured display label, a neutral View Review URL button, and a success-styled Write Review deep link. The Write Review link opens the bot's private chat with the `review` start payload and starts the existing review flow. Notification failures must be logged but must not mark an already-published review as failed.

## Review post format
Use a consistent, clean layout: category/title heading, release year and optional season, a numeric score with a dynamic danger (1–4), primary (5–7), or success (8–10) button, plus an optional verdict button with its own style, review body, spoiler-protected text when marked, reviewer attribution, and an optional image slideshow. When a slideshow has multiple images, add a hardcoded caption based on the review category: movie, TV series, drama, or anime. Use the same renderer and caption in the user's preview and the published forum-topic post; do not ask users to enter or edit captions. Prefer native Telegram Rich Message formatting after verifying the exact current Bot API input schema. Do not assume ordinary Markdown is automatically parsed as Rich Message or that `sendRichMessage` accepts media. If poster and formatted review need separate messages, send both to the same `message_thread_id`, store both message IDs, and implement partial-failure recovery.

Escape/safely construct user text so it cannot inject Rich Message formatting or links. Spoiler text must actually be protected; a warning label alone is insufficient.

## Forum setup and owner controls
After `/connect`, configure the General notification destination by sending `/settopic general` directly in General; General has no `message_thread_id` in ordinary updates and its fixed ID is 1. Configure review-category and leaderboard topics by sending `/settopic <category_key>` from inside each matching forum topic. The handler reads `message.message_thread_id` from that command update and stores it against the selected category. This avoids manually copying numeric topic IDs.

Suggested owner-only commands:
- `/connect`: connect/verify the current forum supergroup.
- `/settopic <category>`: configure a category's topic ID using a documented topic-context flow.
- `/settings`: show destination and per-category setup status.
- `/stats`: private owner-only aggregate statistics.
- `/disconnect`: disable publishing after confirmation.

Validate that the destination is a supergroup with forum topics enabled and that the bot has the permissions required to send text and media. For leaderboard member tags, also grant the bot the `can_manage_tags` administrator right. Verify each configured topic belongs to the connected group. Do not invent an API method for retrieving topic IDs; inspect current update fields and Bot API methods. If needed, capture `message_thread_id` from a documented update generated inside the target topic.

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
- reviews: review ID, author ID, category, title, year, optional season, required numeric rating (1–10), optional verdict key, text, optional Telegram poster file ID, spoiler flag, status, timestamps, published message IDs/link.
- review_drafts: one active draft per Telegram user, current wizard step, serialized validated payload, and timestamps.
- Optional aggregate counters for owner stats; avoid storing raw activity unnecessarily.

Use documented `sdk/db` schema/query APIs and appropriate integer handling for Telegram IDs. Validate relationships in application code where necessary. Drafts are user-scoped and persist across update invocations. No background timer assumptions.

Publishing states should include `draft`, `publishing`, `published`, and `failed`. Validate immediately before sending; prevent duplicate callback processing and concurrent publish attempts. Store each sent message ID as soon as known. If a multi-message publish partially succeeds, record that state and recover without blindly duplicating successful sends. Schema deployment does not apply migrations. Never run `npx tgcloud migrate` without explicit approval after reviewing the proposed migration.

## Security, privacy, and abuse prevention
- Every admin action is checked against trusted owner identity on the server.
- Users can access only their own drafts and review history.
- Validate category, title, year, a valid numeric rating (1–10) and an optional supported verdict, season, text length, and media type/size.
- Treat all incoming update/callback fields as untrusted.
- Accept Telegram photo uploads for posters; do not fetch arbitrary user-supplied URLs in MVP.
- Apply reasonable per-user draft limits and duplicate-submit protection.
- Expire/clean drafts through normal supported mechanisms; do not depend on timers.
- Return human-readable errors; never expose raw exceptions, credentials, or internal platform errors.
- Store only data required for review publication and history.

## Implementation roadmap
### Phase 1 — Repository/project setup (completed)
- Project scaffold, repository documentation, manual workflow secret mapping, first deployment, and successful CLI status verification are complete.
- Verified Serverless app ID: `8789022672`.
- Keep all bot files under `bots/ReviewTVBot/`.

### Phase 2 — Forum configuration (code deployed; database migration and live setup pending)
- Establish trusted owner identity from the Telegram group creator verified during `/connect`.
- Connect and validate the forum supergroup and bot administrator status.
- Configure/verify all eight review-category topic IDs, the fixed General notification topic (ID 1), and the separate leaderboard topic ID.
- Implement owner-only settings and diagnostics.

### Phase 3 — Database and wizard (implementation in progress on feature branch)
- Add the `review_drafts` table; migration remains approval-gated.
- Persist one active draft per user across Serverless invocations.
- Implement category-first wizard and all review fields.
- Add cancellation and field validation.
- Validate callback ownership and private-chat scope.
- Complete branch validation before merging to `main`; merge will trigger automatic deployment.

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
- Automatic deployment is already enabled for deployable changes on `main`; keep migrations approval-gated and verify the first project-specific deployment before considering further rollout changes.

## Test checklist
- Every category routes to exactly its configured topic.
- A successful review publication sends one notification to the configured General topic; an unconfigured General mapping or notification send failure never blocks or reverses the category review publication.
- The General notification's View Review button opens the published review, and Write Review opens the private bot chat and starts the existing review wizard.
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


## Leaderboard and reviewer profiles (current feature branch)
- Numeric rating remains mandatory for every new review. The optional verdict is stored separately in `rating_verdict`; no sentinel is used. Historical numeric ratings remain unchanged.
- The leaderboard is one persistent Rich Message in its own forum topic. Configure it by sending `/settopic leaderboard` inside that topic as the connected forum owner.
- An authorized admin initializes or repairs it from the bot's private chat with `/leaderboard` (also available in the private admin panel). The command edits the stored message when possible and sends a replacement if it was deleted or cannot be edited.
- The leaderboard displays at most 20 users, ordered by published review count descending. Equal counts are ordered by Telegram user ID for deterministic ranking.
- After each successful review publication, the bot attempts to refresh the stored leaderboard message. A leaderboard update failure must never roll back or mark a published review as failed.
- Reviewer profiles are available from the Start screen and `/profile`. Profile metrics are computed from published review and reaction records; no duplicated counters or extra user profile table is required.
- The schema adds `leaderboard_state` to persist the forum/topic/message identifiers. This requires a separate migration; CI and deployment do not apply it.


## Admin test-data reset (current feature branch)
- /resetdb is owner/admin-only and always requires an explicit confirmation callback.
- It deletes review_reactions before reviews, then clears review_drafts and topic_counters. Deleting review rows also clears all stored numeric ratings and optional rating_verdict values; no separate verdict table exists.
- Preserve community_config, category_topics, and leaderboard_state so the connected forum and persistent leaderboard message remain configured.
- After clearing records, refresh the existing leaderboard message to its empty state. If that refresh fails, the reset still succeeds and the owner receives a note to refresh the leaderboard separately.
- The reset never deletes messages already published in Telegram forum topics. It resets database-backed history and numbering only.


## Leaderboard member tags
- Use Telegram's official `setChatMemberTag` Bot API method to apply the exact rank format `#1 Reviewer` through `#20 Reviewer`.
- The message handler checks only messages in the connected forum's built-in General topic (no `message_thread_id` or fixed ID 1). For each identifiable user message, calculate the user's current position using the same published-review count and deterministic tie-break ordering as the leaderboard.
- Assign or update the tag for a top-20 regular member. If the user falls outside the top 20, remove only a tag matching this feature's `#N Reviewer` format. Never clear or overwrite an unrelated custom member tag.
- Do not assign tags to group administrators or the creator. Telegram member tags apply to regular members; admin custom titles are deliberately out of scope.
- Tag synchronization is best-effort and must never interrupt normal message handling. It occurs when the member next posts in General, not as a background job.
- The bot must have the `can_manage_tags` administrator right. This feature uses the existing reviews and community configuration tables and requires no schema change or migration.


## HTML profile widget demo
- `/widgetdemo` is a private-chat-only demo command. It sends an HTML widget using the official Bot API `sendWidget` method with user-scoped `chat_data`. Do not set `allow_queries` in this demo.
- The widget shows the same database-backed profile metrics as `/profile`: published review count, average rating, verdict-based review count, received likes/dislikes, top-20 leaderboard rank, verdict breakdown, category breakdown, and up to five recent reviews.
- The widget has client-side tabs for Overview, Categories, Verdicts, and Recent Reviews. Its Refresh button opens the bot's private chat using the `widgetdemo` deep link so the bot sends a new snapshot. Do not use `TelegramWidget.request`, `widget_query`, or a `widget_query` Serverless handler: the current Serverless runtime rejects that handler module.
- Keep the widget HTML self-contained (inline CSS/JS, no external resources or network calls), under Telegram's 32 KB HTML and 4 KB compressed limits. Keep `chat_data` within 1024 UTF-8 bytes. Use Telegram theme CSS variables and avoid assumptions about browser APIs.
- Production widgets currently work only in private chats. Do not implement shared-widget or group behavior in this demo.
- This feature reuses existing review/reaction tables and requires no database migration. The original `/profile` Rich Message implementation remains unchanged.
