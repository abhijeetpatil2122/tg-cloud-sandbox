# ReviewTVBot

A Telegram BotFather Serverless bot for community-written movie, TV show, anime, and K/C/J drama reviews.

Users submit reviews privately through a category-first wizard, preview the finished post, and confirm publication. The bot also provides reviewer profiles and a persistent top-20 leaderboard. Published reviews include per-user like/dislike buttons; each user can change or remove their vote. Confirmed reviews are posted directly into the matching topic of one configured Telegram forum supergroup.

## Forum topics

1. Hollywood Movies
2. Bollywood Movies
3. South Indian Movies
4. Other Regional Movies
5. TV Shows & Series
6. Anime
7. K/C/J Dramas — Korean, Chinese, and Japanese drama reviews
8. Leaderboard — automatically refreshed top 20 reviewers

The user chooses a category before entering review details. K/C/J Dramas reuse the TV series year-range and optional season steps; no separate wizard is needed. The bot maps that category to a configured topic ID. The owner creates the forum topics; the bot does not create them automatically.

## Review flow

Choose category → enter title and year → optional series end year → genre hashtags → optional TV season → choose rating (1–10) → write review → optional poster → spoiler flag → preview/edit → confirm and publish.

Genres are displayed as hashtags. Review text supports 20–5000 characters and is shown in an expandable blockquote. TV series can include both a start and end year.

There is no admin approval queue. The author's final confirmation authorizes publication.

## Commands

### Members
- `/start` — main menu.
- `/review` — submit a review.
- `/myreviews` — view your published reviews.
- `/profile` — view your profile, review totals, average rating, received reactions, category breakdown, and recent reviews.
- `/help` — instructions.
- `/cancel` — cancel the current draft.

### Owner
- `/connect` — connect/verify the forum.
- `/settopic` — configure a category topic.
- `/settings` — view configuration.
- `/stats` — private statistics.
- `/leaderboard` — initialize, refresh, or repair the single leaderboard message (private admin command).
- `/resetdb` — temporary admin-only test-data reset; requires confirmation. Clears review records, drafts, and numbering counters, but preserves forum connection/topic mappings and does not delete Telegram forum posts.
- `/disconnect confirm` — disable the destination after confirmation.

Owner actions are restricted to the Telegram creator of the connected forum supergroup. `/connect` verifies the caller against `getChatAdministrators`; later owner commands check the saved creator ID.

## Initial setup

1. Create the bot in BotFather and enable Serverless.
2. Obtain the Serverless CLI access token from BotFather → Serverless → CLI Access.
3. Add it to GitHub repository Actions secrets as `TGCLOUD_TOKEN_REVIEWTVBOT`.
4. Create a supergroup, enable Topics, add the bot as administrator, and grant required text/media permissions.
5. Create the six topics listed above.
6. After the forum setup code is deployed and its database schema is migrated, send `/connect` in the supergroup as its creator. Then open each topic and send `/settopic` followed by its category key (for example, `/settopic hollywood_movies`). The bot captures the topic ID from the update, so you do not need to copy IDs manually. Configure the leaderboard topic with `/settopic leaderboard`, then send `/leaderboard` privately to create its persistent message.

The Serverless CLI token is different from the ordinary Bot API token. Never commit either token or place them in source code.

## Project status

The initial Serverless scaffold and forum-configuration modules have been deployed to app `8789022672`. The deployed schema currently declares `community_config` and `category_topics`, but those tables are not available until the separate database migration is applied. Forum setup commands must not be used until migration succeeds.

GitHub Actions automatic deployment is enabled for deployable changes under `bots/ReviewTVBot/` pushed to `main`. Pull requests run validation only. Database migrations are never part of automatic deployment and require separate review and approval.

The first review-submission wizard implementation is on the `feature/reviewtvbot-phase3` branch for validation. It captures category, title, year, optional TV season, rating, review text, optional poster, and spoiler status, and persists the draft between updates. Preview/edit and publishing remain the next phases.

See [AGENTS.md](./AGENTS.md) for the complete architecture, roadmap, security rules, test checklist, and deployment requirements.
