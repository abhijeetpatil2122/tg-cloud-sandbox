import { fetch, db } from 'sdk';
import { eq } from 'sdk/db';
import { settings } from '../schema.js';

const TOKEN_KEY = 'telegraph_token';
const LEGACY_TOKEN_KEY = '39290dea4e906e932a0ed05dba7d03c73c2a02e5d856b34b1c1455adb3e6';
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

  // Validate the supplied token before persisting it.
  await call('getAccountInfo', {
    access_token: token,
    fields: JSON.stringify(['short_name', 'author_name', 'author_url']),
  });
  await storeToken(token);
}

async function token() {
  // Prefer the current setting, then migrate the legacy database entry.
  // Database failures are logged internally and do not prevent trying a
  // configured Telegraph credential or creating a fresh account.
  try {
    const saved = await db.select().from(settings).where(eq(settings.key, TOKEN_KEY)).get();
    if (saved?.value) return saved.value;
  } catch (error) {
    console.error('IdPullBot Telegraph settings lookup failed: ' + String(error?.message || error));
  }

  try {
    const legacy = await db.select().from(settings).where(eq(settings.key, LEGACY_TOKEN_KEY)).get();
    if (legacy?.value) {
      try {
        await storeToken(legacy.value);
      } catch (error) {
        console.error('IdPullBot could not migrate its Telegraph setting: ' + String(error?.message || error));
      }
      return legacy.value;
    }
  } catch (error) {
    console.error('IdPullBot legacy Telegraph lookup failed: ' + String(error?.message || error));
  }

  // Earlier versions placed the configured value in this constant. Validate
  // it as an actual Telegraph access token before using it; do not assume a
  // database key is necessarily a valid credential.
  try {
    await call('getAccountInfo', {
      access_token: LEGACY_TOKEN_KEY,
      fields: JSON.stringify(['short_name', 'author_name', 'author_url']),
    });
    try {
      await storeToken(LEGACY_TOKEN_KEY);
    } catch (error) {
      console.error('IdPullBot could not persist the configured Telegraph credential: ' + String(error?.message || error));
    }
    return LEGACY_TOKEN_KEY;
  } catch (error) {
    // The constant may be a legacy storage key rather than a credential.
    console.info('IdPullBot legacy Telegraph credential was not accepted.');
  }

  // Account creation lets article publishing continue even if the settings
  // table cannot be read or written. Persistence is best-effort; the article
  // still uses the returned token for this invocation.
  const account = await call('createAccount', {
    short_name: 'IdPullBot',
    author_name: 'IdPullBot',
    author_url: 'https://t.me/idpullbot',
  });
  if (!account?.access_token) throw new Error('Telegraph did not return an access token.');

  try {
    await storeToken(account.access_token);
  } catch (error) {
    console.error('IdPullBot could not persist a generated Telegraph credential: ' + String(error?.message || error));
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
    author_name: 'IdPullBot',
    author_url: 'https://t.me/idpullbot',
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

  // Telegraph pages have size limits. Publish all report segments and return
  // an index page linking to every segment; never truncate the report.
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
