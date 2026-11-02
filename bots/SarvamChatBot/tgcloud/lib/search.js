import { fetch } from 'sdk';

export const WEB_SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Search the live web for up-to-date facts, current news, official announcements, changing information, or sources needed to verify an answer. Use topic=news for current news and topic=finance for financial information. Always search rather than relying on memory for current or time-sensitive questions.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'A focused search query with key names, dates, location or context.' },
        topic: { type: 'string', enum: ['general', 'news', 'finance'], description: 'Use news for current headlines and events, finance for financial information, otherwise general.' },
        time_range: { type: 'string', enum: ['day', 'week', 'month', 'year'], description: 'Use day for today/latest news and week for broader recent developments.' },
        search_depth: { type: 'string', enum: ['basic', 'advanced'], description: 'Use advanced for complex/high-precision research; basic for ordinary lookups.' },
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
  const searchDepth = args?.search_depth === 'advanced' ? 'advanced' : 'basic';

  const payload = {
    query,
    topic,
    search_depth: searchDepth,
    max_results: 6,
    chunks_per_source: 3,
    include_published_date: true,
    filter_by_published_date: false,
    include_answer: false,
    include_raw_content: false,
    include_images: false,
    safe_search: true,
  };
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
    results: results.map((item) => ({
      title: safeText(item?.title, 240),
      url: typeof item?.url === 'string' && /^https?:\/\//i.test(item.url) ? item.url : '',
      published_date: safeText(item?.published_date, 80),
      content: safeText(item?.content, 1500),
      score: typeof item?.score === 'number' ? item.score : null,
    })).filter((item) => item.url && item.content),
  };
}
