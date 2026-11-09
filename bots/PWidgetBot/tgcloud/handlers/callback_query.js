import { api } from 'sdk';
import { getCategory, getDemo } from '../lib/catalog.js';
import { sendDemo } from './message.js';

async function showCategory(chatId, categoryId) {
  const category = getCategory(categoryId);
  if (!category) return;
  const rows = category.demos.map((id) => {
    const demo = getDemo(id);
    return [{ text: demo?.title || id, callback_data: `demo:${id}` }];
  });
  rows.push([{ text: '‹ Main menu', callback_data: 'nav:home' }]);
  await api.sendRichMessage({
    chat_id: chatId,
    rich_message: { blocks: [
      { type: 'heading', size: 2, text: category.title },
      { type: 'paragraph', text: category.description },
      { type: 'paragraph', text: 'Select a demo to launch it.' },
    ] },
    reply_markup: { inline_keyboard: rows },
  });
}

export default async function (query) {
  if (!query?.id) return;
  const data = String(query.data || '');
  const chatId = query.message?.chat?.id;
  await api.answerCallbackQuery({ callback_query_id: query.id });
  if (!chatId) return;

  if (data === 'nav:home') {
    return api.sendRichMessage({
      chat_id: chatId,
      rich_message: { blocks: [
        { type: 'heading', size: 2, text: 'PWidgetBot — Widget Playground' },
        { type: 'paragraph', text: 'Choose a category and explore real Telegram HTML Widgets.' },
      ] },
      reply_markup: { inline_keyboard: [
        [{ text: 'Interactive', callback_data: 'cat:interactive' }, { text: 'Mini Games', callback_data: 'cat:games' }],
        [{ text: 'Dashboards', callback_data: 'cat:dashboards' }, { text: 'Utilities', callback_data: 'cat:utilities' }],
        [{ text: 'TON & Wallet', callback_data: 'cat:wallet' }, { text: 'Developer Lab', callback_data: 'cat:developer' }],
      ] },
    });
  }
  if (data === 'nav:about') return api.sendMessage({ chat_id: chatId, text: 'PWidgetBot is a universal Telegram HTML Widget playground. Use /demos to explore.' });
  if (data.startsWith('cat:')) return showCategory(chatId, data.slice(4));
  if (data.startsWith('demo:')) {\n    if (query.message?.chat?.type !== 'private') {\n      return api.sendMessage({ chat_id: chatId, text: 'HTML Widgets are currently available in private chats only. Open PWidgetBot privately to launch this demo.' });\n    }\n    return sendDemo(chatId, data.slice(5));\n  }
  if (data.startsWith('share:')) {
    const widgetId = data.slice(6);
    if (!widgetId || widgetId.length > 64) return;
    return api.sendSharedWidget({ chat_id: chatId, widget_id: widgetId, caption: 'PWidgetBot · Shared widget demo' });
  }
}
