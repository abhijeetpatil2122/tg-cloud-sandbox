import { api } from 'sdk';
import { searchDocs, toInlineResult, getFallbackResult } from '../lib/docs.js';

export default async function (inlineQuery) {
  const query = String(inlineQuery.query || '').trim();
  const offset = String(inlineQuery.offset || '0');
  try {
    const result = await searchDocs(query, offset);
    await api.answerInlineQuery({
      inline_query_id: inlineQuery.id,
      results: result.results.map((item, index) => toInlineResult(item, index, result.version)),
      next_offset: result.nextOffset || '',
      cache_time: 60,
      is_personal: true,
    });
  } catch (error) {
    console.error('RichDocsBot inline search failed:', error && error.message ? error.message : error);
    await api.answerInlineQuery({
      inline_query_id: inlineQuery.id,
      results: [getFallbackResult()],
      next_offset: '',
      cache_time: 5,
      is_personal: true,
    });
  }
}
