import { fetch } from 'sdk';
import { API_SCHEMA_URL, CACHE_TTL_MS } from './config.js';
import { buildIndex } from './indexer.js';

let cachedIndex;
let cachedAt = 0;
let inFlight;

export async function getIndex() {
  const now = Date.now();
  if (cachedIndex && now - cachedAt < CACHE_TTL_MS) return cachedIndex;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const response = await fetch(API_SCHEMA_URL, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error('Bot API schema request failed (' + response.status + ')');
    const document = await response.json();
    if (!document?.paths || !document?.components?.schemas) throw new Error('The Bot API schema response has an unexpected shape');
    cachedIndex = buildIndex(document);
    cachedAt = Date.now();
    return cachedIndex;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = undefined;
  }
}