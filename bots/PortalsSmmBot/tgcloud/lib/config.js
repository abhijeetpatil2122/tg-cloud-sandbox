/**
 * PortalsSmmBot shared runtime configuration.
 *
 * The provider key is intentionally blank in the repository.
 * Add it only in the bot's Serverless library editor after the first
 * reviewed deployment. Never paste it into Telegram chat or commit it.
 *
 * NOTE: a key entered here in the cloud is part of deployed source and is
 * readable by people with sufficient Serverless project/CLI access.
 */

export const BOT_NAME = 'Portals SMM';
export const BOT_USERNAME = ''; // Set after BotFather username is finalized.

export const ADMIN_IDS = []; // Add approved numeric Telegram user IDs before enabling admin tools.

export const PROVIDER = Object.freeze({
  name: 'smm.plus',
  endpoint: 'https://smm.plus/api/v2',
  apiKey: '', // Set manually in BotFather > Serverless > Library > config.js.
  timeoutMs: 15000,
});

export const WALLET = Object.freeze({
  pointsPerPaidStar: 1,
  pointLabel: 'Portal Points',
});

export const REFERRALS = Object.freeze({
  rewardPercent: 10,
  minimumQualifyingStars: 0, // Owner must set a non-zero threshold before launch.
});

export const PRICING = Object.freeze({
  targetGrossMarginPercent: 30,
  roundingStep: 5,
  roundingMode: 'nearest',
  accountingInrPerPoint: null, // Set only after approving the live accounting FX source.
});

export const SUPPORT = Object.freeze({
  username: '', // Public support username, without @.
});

export const FEATURES = Object.freeze({
  depositsEnabled: false,
  ordersEnabled: false,
  referralsEnabled: false,
  providerSyncEnabled: false,
});
