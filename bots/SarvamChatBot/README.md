# SarvamChatBot

A Telegram private-chat AI assistant powered by Sarvam AI. Answers use Telegram Rich Messages and stream through Rich Message drafts.

## v1

- Private chats only.
- Sarvam Chat Completions V2 with sarvam-105b.
- SSE token streaming to sendRichMessageDraft.
- Final persisted response through sendRichMessage.
- Per-user conversation history and /reset.
- No groups, Guest Mode, live web search, inline, image, voice or Mini App yet.

## Configure Sarvam

Important: current official Telegram Serverless docs do not document runtime environment variables or a native secret store. A GitHub Actions secret called SARVAM_API_KEY is not automatically visible inside deployed modules.

After deploying the code and applying the initial additive database migration, open the bot in a private chat and send:

/setkey YOUR_SARVAM_API_KEY

The first user to set the key becomes its configuration owner; only that user can rotate it. The bot attempts to delete the credential message and never echoes or logs the key. It is stored in this bot's SQLite-backed settings row. This is application-level database storage, not a claim of end-to-end encrypted secret storage.

## Deploy

Repository: abhijeetpatil21222/tg-cloud-sandbox
Project path: bots/SarvamChatBot
CLI token Actions secret: TGCLOUD_TOKEN_SARVAMCHATBOT

Run Actions → Telegram Serverless CLI:
- bot_path: bots/SarvamChatBot
- expected_app_id: FROM_TOKEN
- mode: status first, then deploy when ready

After deployment, apply the initial database migration separately. The workflow never runs migrations. Then configure the key with /setkey.

## Commands

- /start — introduction and setup status.
- /help — usage help.
- /setkey YOUR_SARVAM_API_KEY — configure or rotate the key.
- /reset — clear the invoking user's conversation history.

See AGENTS.md for runtime constraints, privacy rules and future milestones.
