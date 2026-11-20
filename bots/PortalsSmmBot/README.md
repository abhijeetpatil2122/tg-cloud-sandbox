# PortalsSmmBot

Telegram-first SMM storefront built on Telegram Serverless.

## Current status

The storefront shell, Rich Message navigation, and owner-managed administrator access are in place. The next stages are the Telegram-only service catalogue, wallet and transaction history, Stars deposits, customer orders, referrals, and full administrator tools.

Commerce features remain disabled until their database changes, provider catalogue, pricing, and payment flows have been reviewed and approved.

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

Provider settings are maintained in `tgcloud/lib/config.js`. The owner has chosen to keep a dummy test credential in this module for development. Both the manual and automatic workflows deploy this file normally with the rest of the runtime modules.

The configured value is for testing only. Do not use it for live orders. Never print provider credentials in logs or messages. Before production, replace the dummy value with a protected production credential and restrict access to the repository and Serverless project.

The manual GitHub Actions workflow maps this project to `TGCLOUD_TOKEN_PORTALSSMMBOT`. The project is also included in automatic deployment from `main`. Deploying code does not apply database migrations.

## Database and safety

Wallet history will use transaction records plus an append-only integer-points ledger. Deposits are credited only after Telegram sends a verified `successful_payment` update. Order debits, refunds, referral rewards, and administrator adjustments must have traceable records and idempotency protection.

Schema changes require a separate reviewed migration. No migration, paid provider order, live Stars payment, or refund is run automatically by deployment.

## Development order

1. Provider connectivity and Telegram-only service catalogue.
2. Wallet balance and transaction history.
3. Stars deposits and reconciliation.
4. Curated service ordering and order tracking.
5. Referral programme and complete administrator controls.
6. Terms, support, and launch checks.

See [AGENTS.md](./AGENTS.md) for implementation rules, provider API details, pricing policy, security, and rollout requirements.
