# PortalsSmmBot

Telegram-first SMM storefront built on Telegram Serverless.

## Current status

The storefront now includes Rich Message navigation, the improved start menu, owner-managed administrator access, paginated wallet/order history, Telegram-only catalogue import, Telegram Stars invoice and receipt handling, payment support contact, administrator payment status views, and administrator Stars refund controls.

The schema now also includes deposit intents, payment support tickets, and order history. **The additive database migration completed on 20 November 2026: 5 changes applied, 0 skipped.** The deployed configuration enables read-only provider catalogue sync and Telegram Stars deposits. The owner has confirmed that Telegram services now appear in the customer catalogue.

Customer order submission remains disabled until supplier billing units and the approved Portal Points price model are verified. Referral rewards remain disabled until the owner chooses the minimum qualifying Stars deposit threshold. New supplier services remain disabled until an administrator reviews and prices them.

The current Rich Message UI uses captioned service tables, expandable help guidance, and inline bold formatting. Customer and admin histories exclude unpaid invoice attempts; the admin `/payments` view separates confirmed, review, refunded and failed deposits. `/resetdb` is a temporary, two-step admin-only cleanup for unfinished/test workflow data; it preserves confirmed Stars payments, the append-only wallet ledger, balances, provider catalogue and administrator accounts. Refund handling now surfaces Telegram's actual rejection reason, recognizes already-refunded charges, and supports safe retry of previously rejected attempts. No live refund was run during this update.

## Platform and services

- Telegram Serverless, CLI `@tgcloud/cli@0.2.0`
- Project path: `bots/PortalsSmmBot`
- Serverless CLI credential: `TGCLOUD_TOKEN_PORTALSSMMBOT` (deployment access only)
- Provider: smm.plus API v2 at `https://smm.plus/api/v2`
- Catalogue scope: Telegram services only — boosts, views, reactions, members, shares, and other verified Telegram service variants.
- Customer payments: Telegram Stars (`XTR`)
- Internal wallet: integer Portal Points; 1 paid Star = 1 Portal Point.
- Referral planning: 10% of the first qualifying successful deposit, subject to the configured minimum and abuse controls.
- Pricing planning: 30% target gross margin and nearest-5-point rounding.

## Configuration and deployment

Provider settings are maintained in `tgcloud/lib/config.js` and deployed with the runtime modules. The admin balance check has confirmed that the current credential authenticates successfully. Never print provider credentials in logs or messages; restrict access to the repository and Serverless project.

The manual GitHub Actions workflow maps this project to `TGCLOUD_TOKEN_PORTALSSMMBOT`. The project is also included in automatic deployment from `main`. Deploying code does not apply database migrations.

## Database and safety

Wallet history uses transaction records plus an append-only integer-points ledger. Deposits are credited only after Telegram sends a verified `successful_payment` update. Order debits, refunds, referral rewards, and administrator adjustments must have traceable records and idempotency protection.

The one-time additive migration was explicitly owner-approved and applied with `tgcloud migrate --safe`. Future schema changes still require separate review. Ordinary deployments do not run migrations, provider purchases, live Stars transactions, or refunds.

## Development order

1. Import and review the live Telegram service list.
2. Complete customer order placement, status tracking, refill and cancellation handling after billing units and pricing are verified.
3. Configure the minimum qualifying Stars deposit for referral rewards.
4. Run a controlled end-to-end Stars payment test and reconcile the ledger.
5. Finalize launch checks and administrator support procedures.

See [AGENTS.md](./AGENTS.md) for implementation rules, provider API details, pricing policy, security, and rollout requirements.


## Maintenance update — 21 November 2026

- Refund handling now resolves the canonical Telegram charge ID from the deposit intent linked to the wallet transaction. It validates the ID before creating a wallet hold or calling Telegram. The wallet reference helper no longer truncates stored references.
- Provider connection details include the authenticated balance check, local Telegram catalogue totals, priced/enabled counts, and last sync time. This endpoint does not expose additional supplier profile details.
- Added an administrator service setup guide and `/servicesetup`, including the approved pricing formula and supplier billing-unit warning.
- Added persistent private-chat user tracking, referral attribution via `/start ref_USER_ID`, a `/referral` dashboard, global `/stats`, audited add/remove balance controls, and ban/unban controls.
- Referral rewards remain disabled until the owner configures the qualifying minimum Stars amount and enables the feature. The configured reward remains 10% of the first qualifying successful deposit.
- These new user/referral/moderation features add the `bot_users` table. The schema declaration is committed, but the additive migration has **not** been applied. User tracking and admin features that depend on this table remain inactive until the migration is explicitly approved and applied.
- No migration, live Stars refund, provider order, or wallet adjustment was executed as part of this code update.
