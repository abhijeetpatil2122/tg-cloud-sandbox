# PortalsSmmBot

Telegram SMM storefront project built on Telegram Serverless.

## Current status

**Planning / documentation stage.** The project-specific agent instructions are in [AGENTS.md](./AGENTS.md). No production service catalogue, pricing, Stars conversion, referral reward, admin allowlist, provider credential, or live order policy has been approved.

## Intended stack

- Telegram Serverless, CLI `@tgcloud/cli@0.2.0`
- Bot project path: `bots/PortalsSmmBot`
- Serverless Actions secret: `TGCLOUD_TOKEN_PORTALSSMMBOT`
- Provider API: smm.plus at `https://smm.plus/api/v2`
- Customer payments: Telegram Stars (`XTR`)
- Internal wallet: integer points recorded in an append-only ledger
- Initial UI: native Telegram Rich Messages with editable menu navigation

## Setup

The project scaffold is expected to be created with:

```bash
npm create @tgcloud/bot PortalsSmmBot
```

Keep the resulting scaffold's `package.json`, lockfile, `tgcloud.jsonc`, `tgcloud/`, and `docs/tgcloud-sdk.md` in this folder. Never commit `.tgcloud/`, `node_modules/`, CLI credentials, or secrets.

The manual GitHub Actions workflow maps this project to `TGCLOUD_TOKEN_PORTALSSMMBOT`. Until the numeric app ID is verified from the scoped token, use `FROM_TOKEN` for a status-only workflow run. The project remains manual-only; it is not in the automatic deployment registry.

## Before implementation

Read [AGENTS.md](./AGENTS.md) and resolve the implementation gates listed there, especially secure runtime storage for the smm.plus API key, the wallet atomicity strategy, and owner-approved pricing/referral rules.

Database migrations, deployments, paid provider tests, refunds, and production sales each require separate explicit approval.
