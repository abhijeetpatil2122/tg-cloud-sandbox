# BotZoneBot coding notes

- This project runs on Telegram BotFather Serverless using the official `@tgcloud/cli`.
- Runtime modules live under `tgcloud/`; handlers import the built-in SDK from `sdk`.
- Keep bot-specific source in this directory. Do not commit `.tgcloud/`, CLI credentials, Bot API tokens, or other secrets.
- Use `npx tgcloud status` to inspect local changes and `npx tgcloud push` to deploy.
- Prefer incremental changes and run `node --check` on edited JavaScript before deploying.
- The shared GitHub Actions workflow uses the repository secret `TGCLOUD_TOKEN`; never print or hardcode it.
