import { fetch } from 'sdk';
import {
  TELEGRAPH_ACCESS_TOKEN,
  TELEGRAPH_SHORT_NAME,
  TELEGRAPH_AUTHOR_NAME,
  TELEGRAPH_AUTHOR_URL,
} from './config.js';

const PART_SIZE = 8500;

/**
 * Telegraph's documented POST API accepts form-encoded parameters.
 * The content parameter must be a JSON string containing an array of Node
 * objects. Sending an application/json object with content as an array is
 * not equivalent and can be rejected by Telegraph's API.
 * This module intentionally uses form encoding for both account checks and page publishing.
 * Keep this publisher independently deployable from the message handler for validation.
 * The deployment workflow prints server compiler parameters when a publish attempt fails.
 * This revision triggers the isolated compiler-diagnostics deploy.
 * This run uses the corrected one-line compiler diagnostic patch.
 * The one-time live test verifies account access and article creation before deployment.
 * The message handler imports only exports defined by this module.
 */
async function call(method, data) {
  // Account validation uses GET; article publication remains form-encoded POST.
  let response;

  try {
    if (method === 'getAccountInfo') {
      const fields = encodeURIComponent(JSON.stringify(data.fields || [
        'short_name', 'author_name', 'author_url',
      ]));
      const url = 'https://api.telegra.ph/getAccountInfo?access_token=' +
        encodeURIComponent(String(data.access_token || '')) +
        '&fields=' + fields;
      response = await fetch(url);
    } else {
      const pairs = [];
      const keys = Object.keys(data || {});

      for (let index = 0; index < keys.length; index += 1) {
        const key = keys[index];
        const value = data[key];
        if (value === undefined || value === null) continue;

        let encodedValue = String(value);
        if (Array.isArray(value) || typeof value === 'object') {
          encodedValue = JSON.stringify(value);
        }

        pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(encodedValue));
      }

      response = await fetch('https://api.telegra.ph/' + method, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: pairs.join('&'),
      });
    }
  } catch (error) {
    const detail = String(error?.message || error || 'request failed');
    console.error('IdPullBot Telegraph transport failure: method=' + method + ', error=' + detail);
    throw new Error('TELEGRAPH_TRANSPORT_ERROR:' + method + ':' + detail);
  }

  let rawText = '';
  try {
    rawText = await response.text();
  } catch {
    throw new Error('Telegraph ' + method + ' response could not be read.');
  }

  let payload;
  try {
    payload = JSON.parse(rawText);
  } catch {
    throw new Error(
      'Telegraph ' + method + ' returned a non-JSON response (HTTP ' + response.status + ').',
    );
  }

  if (!response.ok || payload?.ok !== true) {
    const apiError = String(payload?.error || 'UNKNOWN_TELEGRAPH_ERROR');
    console.error(
      'IdPullBot Telegraph API failure: method=' + method +
      ', http=' + response.status +
      ', api_error=' + apiError,
    );
    throw new Error('TELEGRAPH_API_ERROR:' + apiError + ':HTTP_' + response.status);
  }

  return payload.result;
}

function configuredToken() {
  const value = String(TELEGRAPH_ACCESS_TOKEN || '').trim();
  if (!value) throw new Error('TELEGRAPH_TOKEN_NOT_CONFIGURED');
  return value;
}

async function createPage(accessToken, title, content) {
  const page = await call('createPage', {
    access_token: accessToken,
    title: String(title || 'Message Debug').slice(0, 256),
    author_name: TELEGRAPH_AUTHOR_NAME,
    author_url: TELEGRAPH_AUTHOR_URL,
    content,
    return_content: false,
  });

  if (!page?.url) throw new Error('TELEGRAPH_PAGE_URL_MISSING');
  return page.url;
}

function splitCompleteReport(report) {
  const characters = Array.from(String(report));
  const parts = [];
  for (let index = 0; index < characters.length; index += PART_SIZE) {
    parts.push(characters.slice(index, index + PART_SIZE).join(''));
  }
  return parts.length ? parts : [''];
}

export async function createArticle(title, report) {
  const accessToken = configuredToken();
  const parts = splitCompleteReport(report);

  if (parts.length === 1) {
    return createPage(accessToken, title, [
      { tag: 'h3', children: ['IdPullBot Message Debug'] },
      { tag: 'pre', children: [parts[0]] },
    ]);
  }

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
    children: [{
      tag: 'a',
      attrs: { href: url },
      children: ['Part ' + (index + 1) + ' of ' + partUrls.length],
    }],
  }));

  return createPage(accessToken, title, [
    { tag: 'h3', children: ['Complete IdPullBot Message Debug'] },
    { tag: 'p', children: ['The complete report is split into linked parts to preserve every field.'] },
    { tag: 'ul', children: links },
  ]);
}

/**
 * Live diagnostic used by /testtelegraph. It checks the configured token and
 * performs an actual createPage call, so it tests both authentication and the
 * request encoding used for publishing.
 */
export async function testTelegraph() {
  const accessToken = configuredToken();
  let account;

  try {
    account = await call('getAccountInfo', {
      access_token: accessToken,
      fields: ['short_name', 'author_name', 'author_url', 'page_count'],
    });
  } catch (error) {
    if (String(error?.message || '').startsWith('TELEGRAPH_TRANSPORT_ERROR:')) {
      let probe = 'unavailable';
      let telegraphHostProbe = 'unavailable';
      try {
        const response = await fetch('https://example.com/');
        probe = 'reachable (HTTP ' + response.status + ')';
      } catch {
        probe = 'unavailable';
      }
      try {
        const response = await fetch('https://telegra.ph/');
        telegraphHostProbe = 'reachable (HTTP ' + response.status + ')';
      } catch {
        telegraphHostProbe = 'unavailable';
      }
      console.error(
        'IdPullBot outbound HTTPS diagnostic: example.com=' + probe +
        ', telegra.ph=' + telegraphHostProbe,
      );
      throw new Error(
        'TELEGRAPH_TRANSPORT_ERROR:getAccountInfo; example.com=' + probe +
        '; telegra.ph=' + telegraphHostProbe,
      );
    }
    throw error;
  }

  const url = await createPage(accessToken, 'IdPullBot Telegraph Connection Test', [
    { tag: 'h3', children: ['IdPullBot Telegraph Connection Test'] },
    { tag: 'p', children: ['This page confirms that IdPullBot can authenticate and publish articles.'] },
  ]);

  return {
    url,
    shortName: account?.short_name || TELEGRAPH_SHORT_NAME,
    pageCount: account?.page_count,
  };
}
