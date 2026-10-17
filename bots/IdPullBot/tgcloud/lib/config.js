/**
 * IdPullBot runtime configuration.
 *
 * Keep this file free of credentials in a public repository.
 * TELEGRAPH_ACCESS_TOKEN is an optional manual override for private/local
 * deployments. The normal, safer configuration path is /settelegraph, which
 * validates the token and stores it in this bot's Serverless database.
 */
export const TELEGRAPH_ACCESS_TOKEN = '';

export const TELEGRAPH_SHORT_NAME = 'IdPullBot';
export const TELEGRAPH_AUTHOR_NAME = 'IdPullBot';
export const TELEGRAPH_AUTHOR_URL = 'https://t.me/idpullbot';
