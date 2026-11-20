# PortalsSmmBot

Telegram SMM storefront project built on Telegram Serverless.

## Current status

**Planning / documentation stage.** The customer wallet rule is planned as 1 paid Star = 1 Portal Point; referral reward is planned at 10% of the first qualifying deposit; target gross margin is 30%, with prices rounded to the nearest 5 points. The final INR accounting source/rate, referral minimum, catalogue, admin allowlist, provider credential, and live order policy remain open. See [AGENTS.md](./AGENTS.md) for the financial assumptions and security gates.

## Intended stack

- Telegram Serverless, CLI `@tgcloud/cli@0.2.0`
- Bot project path: `bots/PortalsSmmBot`
- Serverless Actions secret: `TGCLOUD_TOKEN_PORTALSSMMBOT`
- Provider API: smm.plus at `https://smm.plus/api/v2`
- Customer payments: Telegram Stars (`XTR`)
- Internal wallet: integer Portal Points (1 paid Star = 1 point) recorded in an append-only ledger
- Planning economics: Telegram's stated US$0.013 reward equivalent per earned Star; provisional ₹1.2119 per point at ₹93.22/USD on 2026-11-20, subject to revalidation
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
