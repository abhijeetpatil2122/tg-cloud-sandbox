import { fetch } from 'sdk';

export const WEB_SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Search the live web when the user asks for current/latest facts, news, prices, releases, schedules, official announcements, changing policies, local/current availability, or when a factual answer needs source verification. Use topic=news for recent events, finance for market/financial topics, general otherwise. Prefer official domains for API, product, government and company documentation. Use advanced depth for multi-part or high-stakes verification; use fast/basic for ordinary current lookups. Do not search for stable general knowledge unless sources are requested.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'A focused search query with key names, dates, location or context.' },
        topic: { type: 'string', enum: ['general', 'news', 'finance'], description: 'Use news for current headlines and events, finance for financial information, otherwise general.' },
        time_range: { type: 'string', enum: ['day', 'week', 'month', 'year'], description: 'Use day for today/latest news and week for broader recent developments.' },
        search_depth: { type: 'string', enum: ['fast', 'basic', 'advanced'], description: 'Use fast for low-latency simple lookups, basic for normal searches, advanced for complex/high-precision research.' },
        include_domains: { type: 'array', items: { type: 'string' }, description: 'Optional domain allowlist when the user requests specific websites or authoritative primary sources.' },
        exclude_domains: { type: 'array', items: { type: 'string' }, description: 'Optional domains to exclude when the user explicitly requests exclusions or unreliable sources must be avoided.' },
        country: { type: 'string', description: 'Optional full country name to boost results for a location-specific general search. Do not use a country code. Only use with topic=general.' },
        exact_match: { type: 'boolean', description: 'Use true only when the query requires exact quoted phrase matching.' },
      },
      required: ['query', 'topic'],
      additionalProperties: false,
    },
  },
};

function safeText(value, limit) {
  return typeof value === 'string' ? value.slice(0, limit) : '';
}

export async function runWebSearch(apiKey, rawArgs) {
  let args;
  try {
    args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
  } catch {
    throw new Error('The search request was not valid JSON.');
  }

  const rawQuery = typeof args?.query === 'string' ? args.query.trim() : '';
  const query = safeText(rawQuery, 400);
  if (query.length < 3) throw new Error('The search query is too short.');

  const topic = ['general', 'news', 'finance'].includes(args?.topic) ? args.topic : 'general';
  const timeRange = ['day', 'week', 'month', 'year'].includes(args?.time_range)
    ? args.time_range
    : (topic === 'news' ? 'day' : undefined);
  const searchDepth = ['fast', 'basic', 'advanced'].includes(args?.search_depth)
    ? args.search_depth
    : 'basic';
  const cleanDomains = (value) => Array.isArray(value)
    ? [...new Set(value.filter((domain) => typeof domain === 'string')
      .map((domain) => domain.trim().toLowerCase())
      .filter((domain) => /^[a-z0-9.-]+$/.test(domain) && domain.length <= 253))].slice(0, 10)
    : [];
  const includeDomains = cleanDomains(args?.include_domains);
  const excludeDomains = cleanDomains(args?.exclude_domains);
  const country = topic === 'general' && typeof args?.country === 'string'
    && args.country.trim().length <= 64
    ? args.country.trim()
    : '';

  const payload = {
    query,
    topic,
    search_depth: searchDepth,
    max_results: 8,
    chunks_per_source: 3,
    include_published_date: true,
    filter_by_published_date: false,
    include_answer: false,
    include_raw_content: false,
    include_images: false,
    safe_search: true,
    include_domains: includeDomains,
    exclude_domains: excludeDomains,
  };
  if (country) payload.country = country;
  if (args?.exact_match === true) payload.exact_match = true;
  if (timeRange) payload.time_range = timeRange;
  if (topic === 'news') payload.max_age_hours = 0;

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = new Error('Live web search request failed.');
    error.status = response.status;
    try { await response.text(); } catch {}
    throw error;
  }

  const data = await response.json();
  const results = Array.isArray(data?.results) ? data.results.slice(0, 6) : [];
  return {
    query,
    topic,
    time_range: timeRange || null,
    response_time: typeof data?.response_time === 'number' ? data.response_time : null,
    results: [...new Map(results.map((item) => {
      const url = typeof item?.url === 'string' && /^https?:\/\//i.test(item.url) ? item.url : '';
      return [url, {
        title: safeText(item?.title, 240),
        url,
        published_date: safeText(item?.published_date, 80),
        content: safeText(item?.content, 1800),
        score: typeof item?.score === 'number' ? item.score : null,
      }];
    }).filter(([url, item]) => url && item.content)).values()],
  };
}
