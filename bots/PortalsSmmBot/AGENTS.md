# PortalsSmmBot — Project Agent Instructions

## Mission

Build **PortalsSmmBot**, a Telegram-first storefront for Telegram channel/group growth services, initially supplied by **smm.plus** and later extensible to additional Telegram service providers.

The bot sells services using Telegram Stars (XTR) and maintains an internal integer points wallet. Users can fund the wallet with Stars, earn promotional referral points under anti-abuse rules, browse a curated service catalogue, place orders, and track fulfilment. The bot must be professional, compact, and menu-driven.

This file is the project-specific source of truth for AI agents. Read the repository-root `/AGENTS.md` and `README.md` first. Do not treat this document as authorization to deploy, migrate, make live purchases, or change production settings.

## Identity and repository

- GitHub repository: `abhijeetpatil2122/tg-cloud-sandbox` (preserve this exact owner spelling).
- Project path: `bots/PortalsSmmBot/`.
- Bot project name: `PortalsSmmBot`.
- Scaffold command supplied by the owner: `npm create @tgcloud/bot PortalsSmmBot`.
- Telegram Serverless CLI: `@tgcloud/cli@0.2.0`.
- GitHub Actions CLI-token secret: `TGCLOUD_TOKEN_PORTALSSMMBOT`.
- The token is a Serverless CLI access token (`app<id>:<secret>`), not the ordinary Bot API token. Never print, commit, paste, or expose it.
- The app ID must be read from the scoped CLI token in the workflow or BotFather; never guess it or request that the owner paste the secret into chat.
- Keep this project isolated under its own directory. Do not change another bot's files or runtime behavior.

## Platform constraints

- Runtime is Telegram Serverless on an isolated JavaScript V8 runtime, not Node.js, a VPS, or a persistent process.
- Runtime imports are limited to documented `sdk` modules and project-local relative imports ending in `.js`. Use `sdk`, `sdk/db`, and documented `sdk/fetch` APIs only.
- No Node built-ins, arbitrary npm packages at runtime, filesystem access, environment-variable assumptions, timers, background workers, or persistent processes.
- Use the built-in SQLite-backed database. Every database operation is asynchronous and must be awaited.
- Handler files are flat under `tgcloud/handlers/`; shared modules belong under `tgcloud/lib/` (nested subdirectories are allowed).
- A handler's default export receives the update payload (e.g. Message, CallbackQuery, PreCheckoutQuery) and may receive `ctx` as the second argument.
- Use the current Serverless SDK docs and the scaffold's `docs/tgcloud-sdk.md` as the implementation authority. Do not assume a Bot API method is missing from the SDK: the Serverless `api` object exposes Bot API methods directly and unwraps results.
- Use `fetch` from `sdk` for outbound SMM provider HTTP requests. Do not use global fetch or Node networking assumptions.
- The project currently needs no Mini App. Keep the first release as a native bot unless the owner later approves a Mini App.

## Product scope and navigation

### Main menu

Private-chat-only customer flow. The main screen should be one editable Rich Message with a clear title, wallet balance, and concise menu buttons. Prefer editing the existing menu message for navigation; avoid sending a new message on every tap. Every child screen has a Back button that returns to the correct parent screen.

Initial menu sections:
- **Services** — browse approved service categories and products.
- **Deposit** — buy internal points using Telegram Stars.
- **Wallet / Profile** — current points balance, referral link, referral stats, and wallet ledger history.
- **My Orders** — recent orders, provider status, quantity, and order details.
- **Referral** — personal deep link, eligible referral count, earned points, and referral rules.
- **Support** — support contact and order-specific help.
- **Terms / FAQ** — clear service limitations, delivery/refill/cancellation terms, and payment/referral rules.

Use Telegram Rich Messages for headings, sections, tables/details where useful, and Rich Message text buttons or block buttons for menu/navigation. Use only verified current Bot API structures. Button callback data must be compact (1–64 bytes), versioned/prefixed, and never contain trusted prices, balances, provider keys, or authorization claims.

### Order flow

1. Choose a category from the curated, enabled catalogue.
2. Choose a service and show its plain-language description, supplier type, unit/rate basis, min/max quantity, refill/cancel flags, and relevant limitations.
3. Collect only the fields required by that provider service type (for example target link and quantity; comments, subscription, drip-feed fields only when supported).
4. Validate the target format, quantity bounds, and all service-specific fields on the server.
5. Calculate and display the final customer price using the active, versioned pricing configuration. Show the debit in points before confirmation.
6. On explicit confirmation, reserve/debit points exactly once and create a durable internal order record.
7. Submit the supplier order and store the supplier order ID and response. Never tell the user an order is placed until the provider confirms it.
8. Show the internal order ID and status. Allow the user to revisit order details and track supported provider status/refill/cancel actions.

A service may be listed only when it is explicitly enabled in the bot's curated catalogue. Do not blindly expose every provider service or trust a client-supplied provider service ID, price, cost, limits, or capabilities.

## smm.plus provider integration

Official API documentation reviewed: https://smm.plus/bp/api (the supplied https://smm.plus/api URL redirects/does not expose the complete documentation to the web reader).

- Endpoint: `https://smm.plus/api/v2`.
- HTTP method: POST.
- Response format: JSON.
- Authentication: provider API key in the POST form body as `key`; never put it in a URL, callback data, logs, Rich Message, or user-visible output.
- The documented actions include:
  - `services` — service catalogue.
  - `add` — create an order; standard form uses `service`, `link`, `quantity`; other service types can require `comments`, `username`, `min`, `max`, `posts`, `old_posts`, `delay`, `expiry`, `runs`, or `interval`.
  - `status` — one provider order status.
  - `multi_status` — multiple statuses (up to 100 order IDs; documentation labels its action inconsistently, so verify with a harmless request before using).
  - `refill` / `multi_refill`, `refill_status` / `multi_refill_status`, `cancel`, and `balance`.
- Provider service records can include `service`, `name`, `type`, `category`, `rate`, `min`, `max`, `refill`, and `cancel`.
- Standard order response includes an `order` ID. Status includes `charge`, `start_count`, `status`, `remains`, and `currency`. Balance includes `balance` and `currency`.
- Provider docs mention a standard API rate limit of up to 60 requests/minute; actual account limits may vary by level. Add conservative throttling and bounded retries.
- Parse and validate all responses. Treat malformed JSON, provider errors, timeouts, HTTP failures, and ambiguous responses as distinct outcomes. Never retry an order-create request blindly after a timeout: the provider may have accepted it even if the response was lost.
- Keep provider API calls server-side only. Cache/snapshot the provider catalogue and refresh deliberately; do not make a provider call for every menu render.
- Store the supplier's service ID and supplier cost/rate snapshot on each internal order so later catalogue changes do not rewrite historical order economics.
- Store provider order IDs and internal order IDs separately.
- Supplier account balance is operational float, not a user's wallet balance. It must never be used to calculate or overwrite customer balances.
- Do not assume API access offers a free sandbox. Service-list and balance reads can test connectivity; a paid order consumes provider funds. Obtain owner approval before any paid test order.
- Do not market services as guaranteed, organic, official, or risk-free unless the exact selected service terms substantiate that claim. Show accurate provider limitations and comply with Telegram rules and applicable law.

### Provider credentials — unresolved implementation gate

The Serverless CLI Actions secret is only for deploying the project. It does not automatically become a runtime secret. The official Serverless documentation reviewed describes the SDK and outbound HTTP but does not establish a general runtime environment-variable/secret-injection facility.

Before implementing live provider calls, verify the supported secure way to store and retrieve an external API key for this Serverless app (for example, a documented BotFather-managed secret/config facility if available). Do not:
- assume `process.env` exists;
- put the SMM API key in committed source, `tgcloud.jsonc`, a public GitHub Actions variable, or frontend code;
- embed the key in a test fixture or log;
- ask the owner to paste it into chat.

If the platform has no suitable runtime secret store, stop and present secure supported alternatives before proceeding.

## Telegram Stars deposits

All bot-sold digital services and wallet deposits must use Telegram Stars with currency `XTR`, following the current Telegram Payments API.

Required payment flow:
1. Create a pending deposit intent in the database with an unguessable opaque payload, owner Telegram ID, exact Stars amount, points credit, conversion-rate/config version, expiry, and pending state.
2. Send a private invoice with `sendInvoice`, currency `XTR`, an empty/omitted provider token as documented for Stars, and exactly one price item.
3. On `pre_checkout_query`, validate the payload against the stored pending intent, payer identity, XTR currency, exact total amount, intent expiry, and current eligibility. Answer within Telegram's 10-second deadline. Never credit at pre-checkout.
4. On `successful_payment`, independently verify currency, amount, payload, owner, and matching pending intent. Credit only from this confirmed update.
5. Persist `telegram_payment_charge_id` and the complete minimum receipt metadata needed for reconciliation/refunds.
6. Make processing idempotent using a unique charge ID and unique deposit-intent reference. Replayed updates must never credit twice.
7. If payment is valid but credit processing encounters an error, preserve a recoverable pending/needs-review record and alert admins; never silently discard a paid receipt.
8. Support admin-reviewed refund handling using `refundStarPayment` when appropriate. A refund must create a matching wallet reversal/debit entry and must not make a previously spent balance negative without an explicit debt/chargeback policy.

A successful `pre_checkout_query` is not proof of payment. Only a verified `successful_payment` may create a deposit credit. Store charge IDs for possible refunds. Do not use screenshots, user messages, forwarded receipts, or client-side state as proof of payment.

### Points and Stars pricing

- Wallet points are internal integer units, not Stars and not provider USD.
- Do not choose a conversion rate, minimum deposit, bonus schedule, or customer-facing price without owner approval.
- Store all rates as integer/rational values or fixed-point integers; do not use binary floating-point for money calculations.
- Every deposit records the Stars paid, points credited, and immutable conversion/config version used.
- Clearly disclose any conversion, bonus, expiry, or refund policy before payment.
- Do not call wallet points cash, withdrawable funds, or Telegram Stars.

## Wallet, ledger, and balance integrity

The ledger is the financial source of truth. A mutable user balance field alone is not acceptable.

- Store all amounts as signed integer points (or a documented smaller fixed unit). Never use floating-point arithmetic for wallet operations.
- Append immutable ledger entries for every credit, debit, reservation, refund, reversal, referral reward, admin adjustment, and order settlement.
- Every ledger entry has a globally unique idempotency/source key, user ID, signed amount, reason/type, reference ID, timestamp, and relevant audit metadata.
- Enforce uniqueness in the database for external event IDs and idempotency keys.
- Derive a user's available balance from ledger entries (or a carefully maintained cache that can always be rebuilt and reconciled from the ledger). Never accept a balance value from a callback, command argument, Mini App, or user input.
- For debits, use a single atomic conditional database write that checks sufficient balance and inserts the unique debit/hold entry together. Do not implement a read-balance-then-write-debit sequence vulnerable to concurrent updates.
- Confirm the exact SQLite SQL/SDK semantics and supported constraints before implementation. The reviewed Serverless docs describe query-builder writes and raw SQL, but do not document a multi-statement transaction API. Do not invent transaction support. If a safe atomic wallet primitive cannot be demonstrated, stop and resolve it before enabling purchases.
- Ledger entries are append-only. Corrections are compensating entries, never edits/deletes of historical financial records.
- Admin adjustments require a private admin-only flow, explicit confirmation, reason, and audit trail. Admin identity is checked server-side on every action.
- Provide an admin reconciliation view: ledger totals by type, unresolved payments/orders, and supplier balance snapshot. Never expose internal provider credentials.

## Referral program and abuse prevention

Referrals are promotional rewards, not proof of a real person. No system can guarantee detection of every multi-account scheme; build layered controls and make rewards reversible only through auditable compensating entries.

- Generate a bot deep link with an opaque/referrer identifier; validate it server-side.
- Attribute a new Telegram user to at most one referrer, only on the user's first eligible private `/start`. Persist the attribution once; later start parameters cannot replace it.
- Reject self-referrals and invalid/nonexistent referrers. Do not award points for a start, click, group join, or mere account registration.
- Recommended qualification event: the referred user completes their first genuine, non-refunded Stars deposit above an owner-configured minimum. The exact threshold and reward amount require owner approval.
- Award the referrer once per referred user, using a unique ledger idempotency key tied to the referred user's qualifying deposit. Do not pay referral rewards on referral-funded points, admin credits, refunded deposits, or repeated deposits.
- Apply owner-configurable caps, cooldowns, minimum account age/activity where feasible, and manual review for suspicious patterns. Do not claim IP/device fingerprinting or other signals unless the platform actually provides them.
- Do not reward chains beyond the approved direct-referral level unless explicitly designed and approved.
- Store referral attribution and qualification state with an auditable reason. Repeated updates, duplicate payments, callback replay, or simultaneous deposit handling must not duplicate rewards.
- Define what happens when a deposit is refunded after a referral reward was issued. Use a compensating referral-reversal ledger entry and a documented negative-balance/debt policy; do not silently erase history.
- Referral terms must clearly prohibit self-referrals, fake accounts, automation, and abuse; reserve the right to withhold suspicious unqualified rewards under transparent terms.

## Database model — planning baseline

Adapt names/columns to the scaffold's exact SDK schema DSL. Do not create or migrate tables until the schema is reviewed and the owner explicitly approves migration.

Expected logical entities:
- `users`: Telegram user ID, minimal profile metadata, first/last seen, referral attribution.
- `wallet_ledger`: append-only points ledger with unique idempotency key and integer amount.
- `deposit_intents`: opaque invoice payload, user, XTR amount, points amount, pricing version, state, expiry.
- `star_payments`: unique Telegram charge ID, invoice payload, payer, amount, currency, receipt metadata, processing state.
- `referrals`: referrer, referred user (unique), attribution timestamp, qualification/reward state.
- `service_catalog`: curated service records, provider ID, enabled flag, category, type, min/max, supplier rate/currency, capabilities, customer pricing version, synced timestamp.
- `orders`: internal order ID, user, service snapshot, validated target/parameters, quantity, points debit, supplier cost snapshot, state, provider order ID, status snapshots, timestamps.
- `order_events`: append-only audit timeline for order submission, provider updates, cancellations, refills, refunds, and admin actions.
- `user_sessions`: persisted navigation/input state with user ownership and expiry.
- `bot_settings`: owner-controlled pricing, deposit conversion, referral policy, support details, and feature switches.
- `admin_audit_log`: privileged actions with actor, action, reason, reference, timestamp.

Serverless SQLite has no enforced foreign keys. Enforce relationships in application code and use unique indexes/constraints for idempotency. Avoid storing unnecessary personal data.

## Order execution, idempotency, and reconciliation

- Model order lifecycle explicitly, for example: `draft` → `awaiting_confirmation` → `debit_reserved` → `submitting` → `submitted` → provider status states (`pending`, `in_progress`, `completed`, `partial`, `canceled`, `failed`).
- A customer confirmation callback is one-use and owner-bound. A replay cannot debit or submit a second order.
- Persist the reservation and order intent before contacting the provider.
- Because the provider API does not document an idempotency key for `add`, a timeout or connection loss after submission is an ambiguous outcome. Mark it `submission_unknown`, do not automatically resubmit, and reconcile using provider support/account order records or a deliberate operator process.
- If provider rejects the order definitively before creating it, release/refund the reserved points exactly once with a compensating ledger entry.
- If the provider accepts it, store the provider order ID and never refund simply because the first status is pending/in progress.
- Partial/canceled/failed provider orders require a clear policy based on provider charge and delivered quantity. Do not auto-refund a full amount for partial completion. Calculate any eligible refund from verified provider status/charge and the approved pricing policy.
- Provider status polling must be bounded and rate-limited. There is no assumed persistent timer or background worker. Use user-triggered refresh, supported scheduled mechanisms only if later verified, or admin/manual reconciliation.
- Refill/cancel requests are actions, not guaranteed outcomes. Check service capability and current order state, persist request state, and show provider-confirmed result only.
- Reconcile provider status and supplier charge against internal order snapshots. Keep raw provider responses only when useful and safe; redact credentials and sensitive target data from logs.

## Security and abuse controls

- All commerce flows are private-chat-only.
- Resolve user identity from Telegram's update `from.id`; never trust a user ID supplied in callback data or message text.
- Verify callback message ownership, session ownership, current state, and callback freshness on every action.
- Use opaque, expiring, one-time confirmation tokens or server-side session records.
- Validate all user input server-side: link/username format, allowed target types, quantity bounds, comments length/format, service type, and exact active service mapping.
- Escape/safely construct user-supplied text in Rich Messages. Do not let a target URL or comments inject formatting, links, or callback data.
- Add per-user rate limits for order creation, deposit intent creation, referral attempts, and repeated invalid inputs.
- Keep provider keys, bot tokens, CLI tokens, and private operational data out of messages, source control, client code, and logs.
- Restrict admin commands/callbacks to a fixed server-side admin allowlist or a verified owner bootstrap design approved by the project owner. Hiding admin options is not authorization.
- Admin actions that alter pricing, catalogue availability, points, referrals, refunds, or provider settings require confirmation and audit logging.
- Fail closed when payment, ledger, service catalogue, pricing, or provider state is uncertain.

## Rich Message UX and message editing

- Use Rich Messages as the default presentation format. Native Bot API Rich Message supports structured blocks, text buttons, and buttons blocks with `danger`, `success`, `primary`, and `link` styles.
- Use callback buttons for navigation and actions; use URL buttons only for external destinations such as support links.
- Edit the same bot menu message for category/service/profile/order navigation where Telegram permits. Handle cases where a message cannot be edited by sending a replacement and updating the session's message ID.
- Keep callback data short and non-sensitive. All important state is loaded from the database.
- Keep the UI professional, minimal, readable, and consistent. Do not add emoji to every line or use cluttered layouts.
- Always provide Back navigation and a safe way to return to the main menu. A stale callback should produce a brief refresh/reopen prompt rather than perform an action.

## Admin and operations

Admin tools will eventually include:
- provider connectivity and supplier balance check;
- catalogue sync/review and service enable/disable;
- pricing and margin configuration;
- pending/ambiguous provider order reconciliation;
- user lookup and ledger audit;
- deposit/refund reconciliation;
- referral abuse review;
- operational statistics and support configuration.

Do not hardcode an admin ID until the owner supplies/confirms the intended admin list. Never allow admins to directly set a user's balance; use an audited adjustment ledger entry.

## Pricing and profitability

No customer prices, points conversion, margin, Stars deposit tiers, referral reward amounts, or discounts are approved yet.

For each service, calculate supplier cost from the API's rate and documented billing unit. The public API examples show rates but the exact unit/interpretation must be verified for each service type/account. Convert USD supplier costs into an internal cost basis using an owner-approved exchange-rate source/snapshot. Then calculate customer points/Stars pricing using an explicit margin/fee policy, rounding upward to avoid undercharging.

Store:
- supplier rate, unit basis, currency, quantity, computed supplier cost;
- exchange rate and source/version;
- customer price and pricing version;
- gross margin estimate and timestamp.

Never assume all provider rates are per 1,000 without confirming the service's actual unit. Revalidate supplier cost and availability before enabling a service. Keep a safety margin for exchange-rate changes, Stars economics, refunds, and support.

## Testing and rollout gates

Before any live sales:
- unit-test ledger idempotency, concurrent debit attempts, duplicate payment updates, invalid payloads, and negative-balance prevention;
- test referral self-referral, repeat start, attribution overwrite, multiple simultaneous qualification events, refunds, and reward reversal;
- test provider service parsing, form encoding, error handling, rate limiting, timeout/ambiguous order submission, and duplicate-submit prevention;
- test order state transitions and provider partial/cancel/refill states;
- test callbacks from another user, stale callbacks, malformed payloads, and admin authorization;
- verify every financial action has a ledger/audit record;
- run `node --check` on every runtime module and any project tests;
- inspect `npx tgcloud status` and `npx tgcloud diff` before deploy.

Keep the bot manual-deploy-only until its first deployment and live tests are explicitly approved. Do not add it to the auto-deploy registry without the owner's later approval.

## Migrations and deployment

- The manual workflow must map `bots/PortalsSmmBot` to `TGCLOUD_TOKEN_PORTALSSMMBOT`.
- Use `FROM_TOKEN` until the app ID is independently verified from the scoped CLI token.
- First run the manual workflow in `status` mode. A status run does not deploy.
- Never run `npx tgcloud migrate` without explicit owner approval after reviewing the exact migration plan.
- Neither manual nor automatic CI deployment may run migrations.
- Keep this project out of the auto-deploy registry unless explicitly approved after successful live testing.
- Never deploy, migrate, place a paid provider order, or issue a refund merely because an agent has prepared code.
- Do not commit `.tgcloud/`, `node_modules/`, local credentials, secrets, or `.env` files.

## Current phase and decisions still required

**Current phase: architecture and planning. No production catalogue, pricing, rewards, or live order policy has been approved.**

Resolve with the owner before implementing live commerce:
1. Verify how the smm.plus API key can be securely made available to Serverless runtime modules.
2. Confirm admin Telegram ID(s).
3. Decide whether wallet points are pegged to Stars (and the exact conversion) or use a separate points rate.
4. Decide deposit tiers/minimum and any deposit bonus.
5. Decide referral qualification threshold, reward amount, caps, and reversal policy. Recommended default is reward only after a referred user's first qualifying paid Stars deposit.
6. Confirm which provider services/categories are allowed in the first launch and the intended target types.
7. Approve pricing source, FX handling, margin, and rounding policy.
8. Confirm support contact and service/refund/terms wording.
9. Confirm whether users may order only from private chats (recommended: yes).
10. Confirm the provider's exact order rate unit, refund/partial-completion behavior, and any service-specific restrictions before public listing.

## Official and provider references

- Telegram Serverless (AI-readable): https://core.telegram.org/bots/serverless.md
- Telegram Bot API (AI-readable): https://core.telegram.org/bots/api.md
- Telegram Rich Messages: https://core.telegram.org/bots/rich-messages.md
- Telegram Stars payments: https://core.telegram.org/bots/payments-stars
- Telegram Bot API changelog: https://core.telegram.org/bots/api-changelog.md
- smm.plus API: https://smm.plus/bp/api
- smm.plus reseller/API overview: https://smm.plus/telegram-reseller-api
