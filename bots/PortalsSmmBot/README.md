# PortalsSmmBot

Telegram SMM storefront project built on Telegram Serverless.

## Current status

**Foundation stage — not deployed.** A command-only runtime shell is now present with `/start`, `/menu`, `/help`, an owner-protected administrator panel, a shared configuration module, and basic Rich Message navigation. Dynamic administrator management uses a new SQLite schema and requires migration before use. Commerce features are not enabled. No database migration, Stars payment, provider order, or production deployment has occurred.

## Intended stack

- Telegram Serverless, CLI `@tgcloud/cli@0.2.0`
- Bot project path: `bots/PortalsSmmBot`
- Serverless CLI credential: `TGCLOUD_TOKEN_PORTALSSMMBOT` (deployment access only)
- Provider API: smm.plus at `https://smm.plus/api/v2`
- Provider key: manually configured in the cloud-owned `tgcloud/lib/config.js` using BotFather's Serverless code editor; never committed to GitHub or sent through chat
- Customer payments: Telegram Stars (`XTR`)
- Internal wallet: integer Portal Points (1 paid Star = 1 point) recorded in an append-only ledger
- Planning economics: 10% first-qualifying-deposit referral reward; 30% target gross margin; service prices rounded to nearest 5 points
- Initial UI: native Telegram messages and Rich Message buttons only; no Mini App

## Setup

The starter project uses the official Serverless CLI package:

```bash
npm install
npm run check
npx tgcloud status
```

Keep the project isolated in this folder. Never commit `.tgcloud/`, `node_modules/`, CLI credentials, or provider secrets. The cloud-edited provider key is part of server-side source and is visible to people with sufficient Serverless project/CLI access. A deployment must preserve the cloud-owned key configuration; do not blindly push over it.

The manual GitHub Actions workflow maps this project to `TGCLOUD_TOKEN_PORTALSSMMBOT`. It remains manual-only and is not part of the automatic deployment registry. Status checks are not deployments. No migration or deployment is authorized by the presence of this scaffold.

## Next implementation stages

1. Confirm admin Telegram IDs and finish configuration ownership/deployment preservation.
2. Review the database schema and safe atomic wallet/ledger strategy before migration.
3. Implement Stars deposit intents and idempotent payment crediting.
4. Implement provider read-only connectivity/catalogue sync, then a curated service catalogue.
5. Implement order confirmation, debit reservation, provider submission, status tracking, and reconciliation.
6. Add referral qualification/reversal, admin tools, terms, support, and operational reporting.

See [AGENTS.md](./AGENTS.md) for the full architecture, security, economics, and rollout gates.
