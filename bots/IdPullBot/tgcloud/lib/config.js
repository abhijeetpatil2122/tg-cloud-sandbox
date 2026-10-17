/**
 * IdPullBot runtime configuration.
 *
 * Keep this file free of credentials in a public repository.
 * The manual GitHub Actions deployment injects TELEGRAPH_ACCESS_TOKEN_IDPULLBOT
 * into this placeholder at deploy time. The token is never committed to this
 * public source file. /settelegraph remains available as a database fallback.
 */
export const TELEGRAPH_ACCESS_TOKEN = '';

export const TELEGRAPH_SHORT_NAME = 'IdPullBot';
export const TELEGRAPH_AUTHOR_NAME = 'IdPullBot';
export const TELEGRAPH_AUTHOR_URL = 'https://t.me/idpullbot';
