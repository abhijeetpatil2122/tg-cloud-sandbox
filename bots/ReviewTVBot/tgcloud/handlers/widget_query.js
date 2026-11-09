import { api } from 'sdk';
import { getUserProfileWidgetData } from '../lib/profile.js';
import { serializeProfileWidgetData } from '../lib/profile_widget.js';

export default async function (query) {
  if (!query?.id) return;
  try {
    if (
      query.type?.type !== 'data' ||
      query.data !== 'refresh' ||
      query.chat?.type !== 'private' ||
      !query.from?.id ||
      Number(query.chat.id) !== Number(query.from.id)
    ) {
      return api.answerWidgetQuery({
        widget_query_id: query.id,
        data: JSON.stringify({ error: 'This profile request is not available.' }),
      });
    }
    const profile = await getUserProfileWidgetData(query.from);
    const data = serializeProfileWidgetData(profile);
    return api.answerWidgetQuery({ widget_query_id: query.id, data });
  } catch (error) {
    console.error('ReviewTVBot widget query failed', error?.description || error?.message || error);
    try {
      return await api.answerWidgetQuery({
        widget_query_id: query.id,
        data: JSON.stringify({ error: 'Could not refresh your profile. Please try again.' }),
      });
    } catch (answerError) {
      console.error('ReviewTVBot widget query answer failed', answerError?.description || answerError?.message || answerError);
    }
  }
}
