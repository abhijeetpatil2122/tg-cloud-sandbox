import { api } from 'sdk';

export default async function (query) {
  if (!query?.id) return;

  const data = query.data ?? '';
  await api.answerCallbackQuery({
    callback_query_id: query.id,
    text: data === 'richdemo:callback' ? 'Rich Message callback works!' : 'Callback received.',
    show_alert: false,
  });
}
