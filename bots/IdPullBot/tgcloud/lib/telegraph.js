import { fetch, db } from 'sdk';
import { eq } from 'sdk/db';
import { settings } from '../schema.js';
import {
  TELEGRAPH_ACCESS_TOKEN,
  TELEGRAPH_SHORT_NAME,
  TELEGRAPH_AUTHOR_NAME,
  TELEGRAPH_AUTHOR_URL,
} from './config.js';

const TOKEN_KEY = 'telegraph_token';
const PART_SIZE = 8500;

async function call(method, data) {
  const form = Object.entries(data)
    .map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(String(value)))
    .join('&');

  const response = await fetch('https://api.telegra.ph/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Telegraph ' + method + ' returned an unreadable response (HTTP ' + response.status + ').');
  }

  if (!response.ok || !payload?.ok) {
    throw new Error(
      'Telegraph ' + method + ' failed (HTTP ' + response.status + '): ' +
      String(payload?.error || 'unknown Telegraph API error'),
    );
  }

  return payload.result;
}

async function storeToken(accessToken) {
  await db.insert(settings)
    .values({ key: TOKEN_KEY, value: accessToken })
    .onConflictDoUpdate({ target: settings.key, set: { value: accessToken } })
    .run();
}

export async function saveTelegraphToken(accessToken) {
  const token = String(accessToken || '').trim();
  if (!token || /\s/.test(token)) throw new Error('Invalid Telegraph access token.');

  // Validate against Telegraph before writing the credential to this bot's DB.
  await call('getAccountInfo', {
    access_token: token,
    fields: JSON.stringify(['short_name', 'author_name', 'author_url']),
  });
  await storeToken(token);
}

async function token() {
  // Explicit configuration wins. This supports private deployments that
  // choose to configure a token in config.js instead of using /settelegraph.
  const configured = String(TELEGRAPH_ACCESS_TOKEN || '').trim();
  if (configured) return configured;

  // Prefer the token saved by /settelegraph.
  try {
    const saved = await db.select().from(settings).where(eq(settings.key, TOKEN_KEY)).get();
    if (saved?.value) return saved.value;
  } catch (error) {
    console.error('IdPullBot Telegraph settings lookup failed: ' + String(error?.message || error));
  }

  // Create an account only when no configured or saved token is available.
  // If persistence fails, this invocation can still publish using the token.
  const account = await call('createAccount', {
    short_name: TELEGRAPH_SHORT_NAME,
    author_name: TELEGRAPH_AUTHOR_NAME,
    author_url: TELEGRAPH_AUTHOR_URL,
  });
  if (!account?.access_token) throw new Error('Telegraph did not return an access token.');

  try {
    await storeToken(account.access_token);
  } catch (error) {
    console.error('IdPullBot could not persist its generated Telegraph credential: ' + String(error?.message || error));
  }
  return account.access_token;
}

function splitCompleteReport(report) {
  const characters = Array.from(String(report));
  const parts = [];
  for (let index = 0; index < characters.length; index += PART_SIZE) {
    parts.push(characters.slice(index, index + PART_SIZE).join(''));
  }
  return parts.length ? parts : [''];
}

async function createPage(accessToken, title, content) {
  const page = await call('createPage', {
    access_token: accessToken,
    title: String(title || 'Message Debug').slice(0, 256),
    author_name: TELEGRAPH_AUTHOR_NAME,
    author_url: TELEGRAPH_AUTHOR_URL,
    content: JSON.stringify(content),
    return_content: false,
  });

  if (!page?.url) throw new Error('Telegraph did not return an article URL.');
  return page.url;
}

export async function createArticle(title, report) {
  const accessToken = await token();
  const parts = splitCompleteReport(report);

  if (parts.length === 1) {
    return createPage(accessToken, title, [
      { tag: 'h3', children: ['IdPullBot Message Debug'] },
      { tag: 'pre', children: [parts[0]] },
    ]);
  }

  // Telegraph limits each article's content size. Publish every report
  // segment and return an index page linking to all segments.
  const partUrls = [];
  for (let index = 0; index < parts.length; index += 1) {
    partUrls.push(await createPage(
      accessToken,
      String(title || 'Message Debug') + ' — Part ' + (index + 1) + '/' + parts.length,
      [
        { tag: 'h3', children: ['Message Debug — Part ' + (index + 1) + '/' + parts.length] },
        { tag: 'pre', children: [parts[index]] },
      ],
    ));
  }

  const links = partUrls.map((url, index) => ({
    tag: 'li',
    children: [{ tag: 'a', attrs: { href: url }, children: ['Part ' + (index + 1) + ' of ' + partUrls.length] }],
  }));

  return createPage(accessToken, title, [
    { tag: 'h3', children: ['Complete IdPullBot Message Debug'] },
    { tag: 'p', children: ['The complete report is split into linked parts to preserve every field.'] },
    { tag: 'ul', children: links },
  ]);
}
