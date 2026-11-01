# SarvamChatBot — agent instructions

## Current milestone: private chats only

Build a Telegram private-chat AI assistant powered by Sarvam AI. Use Rich Messages for final answers and Rich Message drafts for streaming.

In scope:
- Handle message updates only when chat.type is private.
- /start, /help, /setkey, /reset.
- Sarvam Chat Completions V2, model sarvam-105b, stream=true.
- Parse SSE incrementally using SDK fetch response.body async iteration.
- Stream only choices[].delta.content. Never expose reasoning_content.
- Send partial Rich Markdown with sendRichMessageDraft; always persist the completed answer with sendRichMessage.
- Store a bounded conversation history per Telegram user.

Out of scope until explicitly requested:
- Groups, Guest Mode, web search, inline mode, image/voice input, Mini App, callbacks, other update types.

## Critical secret-handling note

The current official Telegram Serverless SDK docs describe sdk, Bot API, database and outbound fetch, but do not document runtime environment variables or a native secret-injection API. Do not assume process.env, Deno.env, ctx.env, or GitHub Actions secrets are accessible inside deployed modules.

This project configures Sarvam through private /setkey YOUR_SARVAM_API_KEY:
- First user to configure the key becomes the configuration owner.
- Only that Telegram user can rotate it.
- The handler attempts to delete the credential message immediately.
- The key is stored in this bot's own SQLite-backed bot_settings row.
- Never log, echo, forward, or commit the key.
- This is database-backed storage, not a claim of end-to-end encrypted secret storage.
- The schema migration must be applied separately after the schema is deployed. CI must never run migrations.

A GitHub Actions secret named SARVAM_API_KEY alone does not inject the key into the Telegram runtime. Do not add a fake environment lookup. If Telegram documents native runtime secrets later, verify and migrate deliberately.

## Runtime rules

- Only import sdk and its documented submodules, plus this project's own tgcloud modules.
- Use sdk fetch for outbound HTTP. Official Serverless docs confirm response.body supports incremental async iteration for SSE.
- Relative project imports must include .js and stay inside tgcloud.
- No Node built-ins, arbitrary npm runtime packages, filesystem, persistent process, timers, workers, or unsupported globals.
- Await every DB operation. No foreign keys.
- Keep handlers flat under tgcloud/handlers.
- The handler's default export receives the Message payload; ctx is optional second argument.

## Streaming rules

- Sarvam endpoint: POST https://api.sarvam.ai/v2/chat/completions.
- Auth header: api-subscription-key.
- Stream true; consume SSE frames incrementally and handle arbitrary chunk boundaries.
- Ignore malformed/empty frames, usage-only chunks and [DONE].
- Only display delta.content, never reasoning_content.
- Throttle drafts by accumulated text length; draft_id must be a non-zero integer.
- Draft updates are ephemeral previews. Always call sendRichMessage with the complete final answer.
- If a draft call fails, continue collecting the answer and still send the final message.
- Do not enable can_stop until a working cancellation mechanism is implemented.
- Keep final content within Telegram Rich Message limits.

## Data and privacy

- bot_settings is a singleton configuration row, id=1, containing owner Telegram ID and Sarvam key.
- conversation_messages is isolated by Telegram user ID.
- /reset deletes only the invoking user's history, not the shared Sarvam key.
- Never log prompts, completions, credentials, authorization headers, or raw upstream bodies.
- Do not disclose raw upstream errors to users.
- Group updates must be ignored before database/network operations.

## Repository and deployment

- Repository: abhijeetpatil21222/tg-cloud-sandbox. Preserve this exact owner spelling.
- Project path: bots/SarvamChatBot.
- Manual workflow secret: TGCLOUD_TOKEN_SARVAMCHATBOT.
- Use expected_app_id=FROM_TOKEN; the workflow derives and validates the app ID from the scoped CLI token.
- Manual-only. Do not add this project to auto-deploy.
- Never deploy or migrate unless the user explicitly asks.
- Do not modify other bot projects.

## Next milestones — not implemented

1. Add live web search through Sarvam tool calling, bounded usage, source citations, and prompt-injection defenses.
2. Add Telegram Guest Mode via guest_message and answerGuestQuery. Guest replies are one-shot; do not reuse private history.
3. Add privacy-aware group support: commands, explicit mentions and direct replies only; isolate history by group, user and topic.
4. Evaluate image/voice, usage limits, model settings and cancellation separately.

## Validation checklist

- node --check every JavaScript module.
- Confirm all imports are valid SDK modules or local relative .js imports.
- Verify the private-chat guard is the first meaningful handler operation.
- Verify no group or guest handler exists.
- Verify API key and user content never appear in logs.
- Run workflow status before deploy; keep migration separate.
- After deploy, apply the additive schema migration manually, configure /setkey, then test commands, streaming, final delivery, reset, group ignore and owner-only key rotation.
