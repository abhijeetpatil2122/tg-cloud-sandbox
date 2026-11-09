# PWidgetBot

**The Telegram Widget Playground** — one bot to explore the HTML Widget API, interactive examples, TON wallet interactions, and developer-oriented reference demos.

## Product areas

- **Interactive:** shared poll, quiz, feedback rating, clicker, reaction counter, progress tracker.
- **Games:** number guessing, Tic-tac-toe, and a quick quiz challenge.
- **Dashboards:** live counter, progress dashboard, and a compact statistics panel.
- **Utilities:** calculator, random picker, and countdown.
- **TON & Wallet:** request a Telegram wallet card, inspect public wallet fields, receive wallet-signed data, and handle sent-transaction notifications. The current signed-data demo demonstrates receipt only; it does not cryptographically verify signatures, and the transaction demo does not initiate a transfer.
- **Developer Lab:** basic widget, theme-aware HTML, query round-trip, per-message state, shared public state, and API method reference.

## Bot commands

- `/start` — open the playground home.
- `/help` — commands and usage.
- `/demos` — browse categories.
- `/about` — product and API notes.

Use the inline category buttons to launch demos. Widgets are sent only in private chats in the current production Bot API environment. Inline widget responses are not enabled in production.

## Widget architecture

Widget HTML is self-contained and contains inline CSS/JavaScript. It has no network access. A widget cannot write its own Telegram state: it calls `TelegramWidget.request(data)`; the bot validates the request, responds with `answerWidgetQuery`, and updates message or shared state using the relevant edit method.

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
4. Test the bot in a private Telegram chat on a client version that supports HTML Widgets.

No database schema or migration is required for the initial stateless demo catalogue. Keep PWidgetBot manual-deploy only until it has passed live testing.

## Official references

- [Bot API 10.4 changelog](https://core.telegram.org/bots/api-changelog#november-9-2026)
- [Bot API](https://core.telegram.org/bots/api)
- [Telegram Serverless](https://core.telegram.org/bots/serverless)
- [Telegram Widget sandbox technical profile](https://github.com/TelegramMessenger/widget-sandbox/tree/main/docs)
