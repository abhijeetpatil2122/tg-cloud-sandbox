# ReviewTVBot

A Telegram BotFather Serverless bot for community-written movie, TV show, and anime reviews.

Users submit reviews privately through a category-first wizard, preview the finished post, and confirm publication. Confirmed reviews are posted directly into the matching topic of one configured Telegram forum supergroup.

## Forum topics

1. Hollywood Movies
2. Bollywood Movies
3. South Indian Movies
4. Other Regional Movies
5. TV Shows & Series
6. Anime

The user chooses a category before entering review details. The bot maps that category to a configured topic ID. The owner creates the forum topics; the bot does not create them automatically.

## Review flow

Choose category → enter title and year → optional TV season → choose rating (1–10) → write review → optional poster → spoiler flag → preview/edit → confirm and publish.

There is no admin approval queue. The author's final confirmation authorizes publication.

## Commands

### Members
- `/start` — main menu.
- `/review` — submit a review.
- `/myreviews` — view your published reviews.
- `/help` — instructions.
- `/cancel` — cancel the current draft.

### Owner
- `/connect` — connect/verify the forum.
- `/settopic` — configure a category topic.
- `/settings` — view configuration.
- `/stats` — private statistics.
- `/disconnect` — disable the destination.

Owner actions are restricted by a trusted configured Telegram user ID.

## Initial setup

1. Create the bot in BotFather and enable Serverless.
2. Obtain the Serverless CLI access token from BotFather → Serverless → CLI Access.
3. Add it to GitHub repository Actions secrets as `TGCLOUD_TOKEN_REVIEWTVBOT`.
4. Create a supergroup, enable Topics, add the bot as administrator, and grant required text/media permissions.
5. Create the six topics listed above.
6. Configure the trusted owner ID and each topic ID through the owner-only setup flow when implemented.

The Serverless CLI token is different from the ordinary Bot API token. Never commit either token or place them in source code.

## Project status

This initial phase establishes the product plan and repository documentation. Runtime handlers, schema, and publishing are subsequent phases. No deployment or database migration is performed by this documentation setup.

See [AGENTS.md](./AGENTS.md) for the complete architecture, roadmap, security rules, test checklist, and deployment requirements.
