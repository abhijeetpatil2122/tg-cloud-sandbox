import { api } from 'sdk';
import { recordInlineUsage } from '../lib/usage-stats.js';
import {
  searchDocs,
  toInlineResult,
  getNoResultsResult,
  getFallbackResult,
  searchErrors,
  toErrorInlineResult,
  getErrorNoResultsResult,
  getErrorFallbackResult,
} from '../lib/docs.js';

export default async function (inlineQuery) {
  const query = String(inlineQuery.query || '').trim();
  const offset = String(inlineQuery.offset || '0');
  const isErrorMode = /^E(?:\s|$)/i.test(query);
  const errorQuery = isErrorMode ? query.replace(/^E(?:\s+|$)/i, '').trim() : '';
  
  try {
    await recordInlineUsage(inlineQuery, isErrorMode);
  } catch (error) {
    // Analytics must never break inline search if the database is not migrated
    // yet or a transient database error occurs.
    console.error('RichDocsBot usage tracking failed:', error && error.message ? error.message : error);
  }

  try {
    if (isErrorMode) {
      const result = await searchErrors(errorQuery, offset);
      const noResults = result.results.length === 0 && errorQuery && Number.parseInt(offset || '0', 10) === 0;
      await api.answerInlineQuery({
        inline_query_id: inlineQuery.id,
        results: noResults
          ? [getErrorNoResultsResult()]
          : result.results.map((item, index) => toErrorInlineResult(item, index, result.version)),
        next_offset: result.nextOffset || '',
        cache_time: 60,
        is_personal: true,
      });
      return;
    }

    const result = await searchDocs(query, offset);
    await api.answerInlineQuery({
      inline_query_id: inlineQuery.id,
      results: result.results.length === 0 && query && Number.parseInt(offset || '0', 10) === 0
        ? [getNoResultsResult()]
        : result.results.map((item, index) => toInlineResult(item, index, result.version)),
      next_offset: result.nextOffset || '',
      cache_time: 60,
      is_personal: true,
    });
  } catch (error) {
    console.error('RichDocsBot inline search failed:', error && error.message ? error.message : error);
    await api.answerInlineQuery({
      inline_query_id: inlineQuery.id,
      results: [isErrorMode ? getErrorFallbackResult() : getFallbackResult()],
      next_offset: '',
      cache_time: 5,
      is_personal: true,
    });
  }
}
