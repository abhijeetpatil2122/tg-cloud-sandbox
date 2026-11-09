import { api } from 'sdk';
import { handleWidgetQuery } from '../lib/widget_actions.js';

export default async function (query) {
  if (!query?.id) return;
  try {
    await handleWidgetQuery(query, false);
  } catch (error) {
    console.error('PWidgetBot widget_query failed:', error?.message || error);
    try {
      await api.answerWidgetQuery({ widget_query_id: query.id, data: JSON.stringify({ ok: false, message: 'Something went wrong. Please try again.' }) });
    } catch (answerError) {
      console.error('PWidgetBot query fallback failed:', answerError?.message || answerError);
    }
  }
}
