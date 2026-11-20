import { api } from 'sdk';
import { sendHome, sendHelp } from '../lib/ui.js';

async function answerCallback(id, text = '') {
  const params = { callback_query_id: id };
  if (text) params.text = text;
  await api.answerCallbackQuery(params);
}

export default async function handleCallbackQuery(update) {
  const query = update?.callback_query;
  if (!query?.id || !query?.from?.id) return;

  const data = String(query.data || '');
  const message = query.message;
  if (!message?.chat?.id || message.chat.type !== 'private') {
    await answerCallback(query.id, 'Open the bot in a private chat.');
    return;
  }

  await answerCallback(query.id);

  if (data === 'ps:home') {
    await sendHome(message.chat.id, query.from.first_name || 'there');
    return;
  }

  if (data === 'ps:help') {
    await sendHelp(message.chat.id);
    return;
  }

  const labels = {
    'ps:services': 'The service catalogue is being prepared.',
    'ps:deposit': 'Stars deposits are not enabled yet.',
    'ps:wallet': 'Your Portal Points wallet will appear here.',
    'ps:orders': 'You do not have any orders yet.',
    'ps:referral': 'The referral programme is being prepared.',
    'ps:support': 'Support details will be published here.',
  };

  await api.sendMessage({
    chat_id: message.chat.id,
    text: labels[data] || 'This menu action is not available yet.',
    reply_markup: { inline_keyboard: [[
      { text: '‹ Main menu', callback_data: 'ps:home' },
    ]] },
  });
}
