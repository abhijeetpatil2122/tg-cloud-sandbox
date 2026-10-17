import { api } from 'sdk';

export default async function (query) {
  if (query?.data !== 'idpull_me') {
    await api.answerCallbackQuery({ callback_query_id: query.id });
    return;
  }

  await api.answerCallbackQuery({ callback_query_id: query.id });

  const userId = query.from?.id;
  if (!Number.isSafeInteger(userId) || userId <= 0) return;

  await api.sendMessage({
    chat_id: query.message?.chat?.id || userId,
    text: '<b>Your Telegram ID</b>\n<code>' + userId + '</code>',
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[{
        text: 'Copy ID',
        copy_text: { text: String(userId) },
      }]],
    },
  });
}
