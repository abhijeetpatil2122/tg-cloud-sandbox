# IdPullBot

Telegram message inspector for @idpullbot.

Private chat reports contain the full Message and raw Update as HTML JavaScript-style code blocks split into safe chunks, followed by a shareable Telegraph article link. Guest mode returns only a minimal article link/button to avoid spamming other chats. The share-user/chat keyboard, copy-ID buttons and aggregate statistics are retained. Inline query handling is intentionally absent.

Serverless app ID: 8288436618
GitHub Actions secret: TGCLOUD_TOKEN_IDPULLBOT. The Telegraph access token is configured directly in `tgcloud/lib/config.js`; no separate Telegraph Actions secret or workflow injection is used.
Manual workflow: select bots/IdPullBot, app ID 8288436618, and status first.
Keep manual-only until first deployment and live Telegram tests are verified. Apply database schema changes only through a separately reviewed migration.
