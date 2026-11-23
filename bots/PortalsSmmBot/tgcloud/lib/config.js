/**
 * PortalsSmmBot shared runtime configuration.
 *
 * Keep provider credentials server-side. Never include them in messages,
 * callback data, frontend code, or logs.
 */

export const BOT_NAME = 'Portals SMM';
export const BOT_USERNAME = '';

export const OWNER_IDS = [6522801911, 1314643983];
export const ADMIN_IDS = [6522801911, 1314643983];

export const PROVIDER = Object.freeze({
  name: 'smm.plus',
  endpoint: 'https://smm.plus/api/v2',
  apiKey: '69d8cb1d4bd4cce2ffc99cf7b8a47fdb',
  timeoutMs: 15000,
});

export const WALLET = Object.freeze({ starsPerDollar: 80, currency: 'USD' });

export const PRICING = Object.freeze({
  targetGrossMarginPercent: 30,
  roundingStep: 5,
  roundingMode: 'nearest',
  accountingInrPerPoint: null,
});

export const SUPPORT = Object.freeze({
  username: 'roexe',
});

export const FEATURES = Object.freeze({
  depositsEnabled: true,
  ordersEnabled: false,
  providerSyncEnabled: true,
});
