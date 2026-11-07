# ReviewTVBot

A Telegram BotFather Serverless bot for community-written movie, TV show, anime, and drama reviews.

Users submit reviews privately through a category-first wizard, preview the finished post, and confirm publication. The bot also provides reviewer profiles and a persistent top-20 leaderboard. Published reviews include per-user like/dislike buttons; each user can change or remove their vote. Confirmed reviews are posted directly into the matching topic of one configured Telegram forum supergroup.

## Forum topics

1. General — main topic for new-review notifications
2. Hollywood Movies
3. Bollywood Movies
4. South Indian Movies
5. Other Regional Movies
6. International Movies — non-Hollywood international cinema, including Japanese, Chinese, Korean, and other world cinema
7. TV Shows & Series
8. K/C/J Dramas — Korean, Chinese, and Japanese drama reviews
9. Anime
10. Leaderboard — automatically refreshed top 20 reviewers

The General topic is a separate system destination (key: `general`, topic ID: `1`) for minimal new-review notifications. It is not a review category. After a review is successfully published in its category topic, the bot posts a Rich Message notification in General with the title, destination category name, a View Review link, and a Write Review deep link.

The user chooses a category before entering review details. International Movies is a separate film category; K/C/J Dramas reuse the TV series year-range and optional season steps. The bot maps that category to a configured topic ID. The owner creates the forum topics; the bot does not create them automatically.

## Review flow

Choose category → enter title and year → optional series end year → genre hashtags → optional TV season → choose a numeric rating (1–10) → optionally choose a verdict (Absolute Cinema, Go for It, Timepass, or Skip It; or skip) → write review → optional images → spoiler flag → preview/edit → confirm and publish.

Genres are displayed as hashtags. Review text supports 20–5000 characters and is shown in an expandable blockquote. TV series can include both a start and end year. When a review includes multiple images, the slideshow receives an automatic category-specific caption (Movie moments, TV series moments, Drama moments, or Anime moments); the same caption appears in the preview and published forum post.

There is no admin approval queue. The author's final confirmation authorizes publication.

## Commands

### Members
- `/start` — main menu.
- `/review` — submit a review.
- `/myreviews` — view your published reviews.
- `/profile` — view your profile, review totals, verdict breakdown, received reactions, category breakdown, and recent reviews.
- `/help` — instructions.
- `/cancel` — cancel the current draft.

### Owner
- `/connect` — connect/verify the forum.
- `/settopic` — configure a category topic, the General notification topic (`/settopic general` from General), or the leaderboard topic.
- `/settings` — view configuration.
- `/stats` — private statistics.
- `/leaderboard` — initialize, refresh, or repair the single leaderboard message (private admin command).
- `/resetdb` — admin-only test-data reset; requires confirmation. Clears review records (including verdicts), reaction votes, active drafts, and per-category numbering counters. It preserves the forum connection, topic mappings, and leaderboard message state, then refreshes the leaderboard. Existing Telegram forum posts are not deleted.
- `/disconnect confirm` — disable the destination after confirmation.

Owner actions are restricted to the Telegram creator of the connected forum supergroup. `/connect` verifies the caller against `getChatAdministrators`; later owner commands check the saved creator ID.

## Initial setup

1. Create the bot in BotFather and enable Serverless.
2. Obtain the Serverless CLI access token from BotFather → Serverless → CLI Access.
3. Add it to GitHub repository Actions secrets as `TGCLOUD_TOKEN_REVIEWTVBOT`.
4. Create a supergroup, enable Topics, add the bot as administrator, and grant required text/media permissions.
5. Create the eight review-category topics listed above, plus the separate Leaderboard topic. General already exists in every forum and does not need to be created.
6. After the forum setup code is deployed and its database schema is migrated, send `/connect` in the supergroup as its creator. In General, send `/settopic general` to configure notification delivery (General has the fixed topic ID 1). Then open each review category topic and send `/settopic` followed by its category key (for example, `/settopic hollywood_movies`). Configure the leaderboard topic with `/settopic leaderboard`, then send `/leaderboard` privately to create its persistent message.

The Serverless CLI token is different from the ordinary Bot API token. Never commit either token or place them in source code.

## Project status

The initial Serverless scaffold and forum-configuration modules have been deployed to app `8789022672`. The deployed schema currently declares `community_config` and `category_topics`, but those tables are not available until the separate database migration is applied. Forum setup commands must not be used until migration succeeds.

GitHub Actions automatic deployment is enabled for deployable changes under `bots/ReviewTVBot/` pushed to `main`. Pull requests run validation only. Database migrations are never part of automatic deployment and require separate review and approval.

The review wizard supports all eight categories, mandatory numeric ratings (1–10), and an optional second verdict choice. Both are stored independently; older reviews retain their numeric scores and new reviews continue to require a numeric score. The nullable `rating_verdict` column requires a separate additive database migration after the code is deployed.

See [AGENTS.md](./AGENTS.md) for the complete architecture, roadmap, security rules, test checklist, and deployment requirements.
