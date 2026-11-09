# PWidgetBot

**The Telegram Widget Playground** — one bot to explore the HTML Widget API, interactive examples, TON wallet interactions, and developer-oriented reference demos.

## Product areas

- **Interactive:** local poll, quiz, feedback rating, clicker, reaction counter, progress tracker.
- **Games:** number guessing, Tic-tac-toe, and a quick quiz challenge.
- **Dashboards:** local live counter, progress dashboard, and a compact statistics panel.
- **Utilities:** calculator, random picker, and countdown.
- **TON & Wallet:** reference demos for wallet cards, signed data, and transaction notifications. Live wallet query handling is not enabled because the current Serverless handler registry does not accept widget query updates.
- **Developer Lab:** basic widget, theme-aware HTML, query protocol reference, message-state preview, shared-state preview, and API method reference.

## Bot commands

- `/start` — open the playground home.
- `/help` — commands and usage.
- `/demos` — browse categories.
- `/about` — product and API notes.

Use the inline category buttons to launch demos. Widgets are sent only in private chats in the current production Bot API environment. Inline widget responses are not enabled in production.

## Widget architecture

Widget HTML is self-contained and contains inline CSS/JavaScript. The interactive demos currently run locally inside the widget. Bot API 10.4 defines `widget_query` and `shared_widget_query`, but the deployed Serverless handler registry currently rejects those module names. Therefore PWidgetBot does not enable `allow_queries`, and it does not claim server-synchronized widget state or live wallet query handling. The API reference demos explain the intended `TelegramWidget.request`, `answerWidgetQuery`, and state-edit flow.

- `chat_data` is state scoped to one widget message.
- `public_data` is shared state for a shared widget.
- Every query is answered, including invalid or failed actions.
- Query payloads and state are bounded to 1024 bytes by the Bot API.

## TON wallet safety

The wallet demos use Telegram's wallet integration only. PWidgetBot never asks for seed phrases, private keys, or recovery phrases. Wallet signing or transaction flows must be initiated by a user and approved in Telegram. This bot does not custody funds.

## Runtime and deployment

This project targets Telegram BotFather Serverless. It uses `@tgcloud/cli` for local tooling and the built-in `sdk` runtime import.

1. Add the Serverless CLI token to GitHub Actions secrets as `TGCLOUD_TOKEN_PWIDGETBOT`.
2. Run the repository's **Telegram Serverless CLI** workflow with `bot_path=bots/PWidgetBot` and `expected_app_id=FROM_TOKEN`, mode `status`.
3. Review the status output and then intentionally run mode `deploy`.
4. Test the local-interaction demos in a private Telegram chat on a client version that supports HTML Widgets.\n5. Auto-deploy runs on pushes to `main` that change deployable PWidgetBot files, after project validation passes.

No database schema or migration is required for the stateless demo catalogue. PWidgetBot is configured for automatic deployment after validated changes reach `main`.

## Official references

- [Bot API 10.4 changelog](https://core.telegram.org/bots/api-changelog#november-9-2026)
- [Bot API](https://core.telegram.org/bots/api)
- [Telegram Serverless](https://core.telegram.org/bots/serverless)
- [Telegram Widget sandbox technical profile](https://github.com/TelegramMessenger/widget-sandbox/tree/main/docs)
