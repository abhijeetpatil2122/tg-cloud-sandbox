import { fetch } from 'sdk';
import { API_ERRORS_URL, CACHE_TTL_MS, MAX_QUERY_RESULTS } from './config.js';

let cachedData;
let cachedAt = 0;
let inFlight;

function asStringArray(value) {
  if (Array.isArray(value)) return value.filter((entry) => typeof entry === 'string');
  return typeof value === 'string' ? [value] : [];
}

function buildErrorIndex(document) {
  if (!document?.errors || typeof document.errors !== 'object' || Array.isArray(document.errors)) {
    throw new Error('The Bot API errors response has an unexpected shape');
  }

  const items = [];
  for (const [code, groupedErrors] of Object.entries(document.errors)) {
    if (!groupedErrors || typeof groupedErrors !== 'object' || Array.isArray(groupedErrors)) continue;
    for (const [message, rawMethods] of Object.entries(groupedErrors)) {
      const mtprotoErrors = asStringArray(document.mtproto_errors?.[message]);
      const mtprotoDescriptions = mtprotoErrors
        .map((name) => document.mtproto_descriptions?.[name])
        .filter((description) => typeof description === 'string' && description.trim());
      const parameters = asStringArray(document.parameters?.[message]);

      items.push({
        code,
        message,
        methods: asStringArray(rawMethods),
        parameters,
        mtprotoErrors,
        mtprotoDescriptions,
        searchText: [code, message, ...asStringArray(rawMethods), ...parameters, ...mtprotoErrors, ...mtprotoDescriptions].join(' ').toLowerCase(),
      });
    }
  }

  if (!items.length) throw new Error('The Bot API errors response contains no error entries');
  items.sort((a, b) => Number(a.code) - Number(b.code) || a.message.localeCompare(b.message));
  return { version: String(document.version || 'unknown'), mtprotoLayer: document.mtproto_layer, items };
}

async function getErrorIndex() {
  const now = Date.now();
  if (cachedData && now - cachedAt < CACHE_TTL_MS) return cachedData;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const response = await fetch(API_ERRORS_URL, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error('Bot API errors request failed (' + response.status + ')');
    const document = await response.json();
    cachedData = buildErrorIndex(document);
    cachedAt = Date.now();
    return cachedData;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = undefined;
  }
}

function page(results, index, offset) {
  return {
    version: index.version,
    mtprotoLayer: index.mtprotoLayer,
    results: results.slice(offset, offset + MAX_QUERY_RESULTS),
    nextOffset: offset + MAX_QUERY_RESULTS < results.length ? String(offset + MAX_QUERY_RESULTS) : '',
  };
}

function containsAllTokens(value, tokens) {
  const text = String(value || '').toLowerCase();
  return tokens.every((token) => text.includes(token));
}

export async function searchErrors(rawQuery = '', rawOffset = 0) {
  const index = await getErrorIndex();
  const query = String(rawQuery || '').trim().toLowerCase();
  const parsedOffset = Number.parseInt(String(rawOffset || '0'), 10);
  const offset = Number.isSafeInteger(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0;

  if (!query) return page([{ kind: 'help', name: 'error-help' }], index, 0);

  if (/^\d{3}$/.test(query)) {
    return page(index.items.filter((item) => item.code === query), index, offset);
  }

  // Exact method names return only errors explicitly associated with that method.
  const exactMethodMatches = index.items.filter((item) =>
    item.methods.some((method) => method.toLowerCase() === query)
  );
  if (exactMethodMatches.length) return page(exactMethodMatches, index, offset);

  const tokens = query.split(/\s+/).filter(Boolean);
  const ranked = index.items.map((item) => {
    const message = item.message.toLowerCase();
    let score = 0;
    if (message === query) score += 160;
    else if (message.startsWith(query)) score += 100;
    else if (message.includes(query)) score += 65;
    if (item.code === query) score += 100;
    for (const token of tokens) {
      if (message.includes(token)) score += 10;
      else if (item.methods.some((method) => method.toLowerCase().includes(token))) score += 4;
      else if (item.searchText.includes(token)) score += 2;
    }
    if (tokens.length && !containsAllTokens(item.searchText, tokens)) return { item, score: 0 };
    return { item, score };
  }).filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || Number(a.item.code) - Number(b.item.code) || a.item.message.localeCompare(b.item.message))
    .map(({ item }) => item);

  return page(ranked, index, offset);
}
