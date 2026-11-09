import { api } from 'sdk';
import { CATEGORIES, getDemo } from '../lib/catalog.js';
import { buildWidgetHtml, getInitialState } from '../lib/widget_factory.js';

const HOME = [
  [{ text: 'Interactive', callback_data: 'cat:interactive' }, { text: 'Mini Games', callback_data: 'cat:games' }],
  [{ text: 'Dashboards', callback_data: 'cat:dashboards' }, { text: 'Utilities', callback_data: 'cat:utilities' }],
  [{ text: 'TON & Wallet', callback_data: 'cat:wallet' }, { text: 'Developer Lab', callback_data: 'cat:developer' }],
  [{ text: 'About PWidgetBot', callback_data: 'nav:about' }],
];

function homeText(firstName) {
  const name = String(firstName || '').trim();
  return [
    { type: 'heading', size: 2, text: 'PWidgetBot — Widget Playground' },
    { type: 'paragraph', text: name ? `Welcome, ${name}. Explore Telegram's new HTML Widget capabilities through live examples.` : 'Explore Telegram HTML Widgets through live examples.' },
    { type: 'paragraph', text: 'Choose a category to launch an interactive demo. Each example is built as a real Telegram widget, not a web-page mockup.' },
    { type: 'divider' },
    { type: 'paragraph', text: 'Interactive demos · Mini games · TON wallet · Dashboards · Utilities · Developer API lab' },
  ];
}

async function sendHome(chatId, firstName) {
  await api.sendRichMessage({
    chat_id: chatId,
    rich_message: { blocks: homeText(firstName) },
    reply_markup: { inline_keyboard: HOME },
  });
}

async function sendCategory(chatId, categoryId) {
  const category = getCategory(categoryId);
  if (!category) return sendHome(chatId);
  const rows = category.demos.map((demoId) => {
    const demo = getDemo(demoId);
    return [{ text: demo.title, callback_data: `demo:${demo.id}` }];
  });
  rows.push([{ text: '‹ Main menu', callback_data: 'nav:home' }]);
  await api.sendRichMessage({
    chat_id: chatId,
    rich_message: { blocks: [
      { type: 'heading', size: 2, text: category.title },
      { type: 'paragraph', text: category.description },
      { type: 'paragraph', text: 'Choose a demo below to send it as an interactive HTML widget.' },
    ] },
    reply_markup: { inline_keyboard: rows },
  });
}

export async function sendDemo(chatId, demoId) {
  const demo = getDemo(demoId);
  if (!demo) {
    await api.sendMessage({ chat_id: chatId, text: 'That demo is not available yet. Use /demos to browse the catalogue.' });
    return;
  }
  const state = getInitialState(demo.id);
  const html = buildWidgetHtml(demo.id, demo.title, demo.description);
  const sent = await api.sendWidget({
    chat_id: chatId,
    html,
    caption: `PWidgetBot · ${demo.title}`,
    allow_queries: false,
    chat_data: JSON.stringify(state),
  });

  return sent;
}

export default async function (message) {
  const text = String(message?.text || '').trim();
  if (!message?.chat?.id || !text.startsWith('/')) return;
  const command = text.split(/\s+/)[0].split('@')[0].toLowerCase();

  if (command === '/start') return sendHome(message.chat.id, message.from?.first_name);
  if (command === '/demos') {
    const rows = CATEGORIES.map((category) => [{ text: category.title, callback_data: `cat:${category.id}` }]);
    rows.push([{ text: '‹ Main menu', callback_data: 'nav:home' }]);
    return api.sendRichMessage({
      chat_id: message.chat.id,
      rich_message: { blocks: [{ type: 'heading', size: 2, text: 'Widget catalogue' }, { type: 'paragraph', text: 'Browse the complete demo catalogue.' }] },
      reply_markup: { inline_keyboard: rows },
    });
  }
  if (command === '/help') {
    return api.sendRichMessage({
      chat_id: message.chat.id,
      rich_message: { blocks: [
        { type: 'heading', size: 2, text: 'PWidgetBot help' },
        { type: 'list', items: [
          { blocks: [{ type: 'paragraph', text: '/start — Open the playground' }] },
          { blocks: [{ type: 'paragraph', text: '/demos — Browse all widget categories' }] },
          { blocks: [{ type: 'paragraph', text: '/help — Show this guide' }] },
          { blocks: [{ type: 'paragraph', text: '/about — Product and API information' }] },
        ] },
        { type: 'paragraph', text: 'Widgets currently send only in private chats in production. Open this bot in a private chat to try the demos.' },
      ] },
    });
  }
  if (command === '/about') {
    return api.sendRichMessage({
      chat_id: message.chat.id,
      rich_message: { blocks: [
        { type: 'heading', size: 2, text: 'About PWidgetBot' },
        { type: 'paragraph', text: 'A showcase for Telegram Bot API 10.4 HTML Widgets, with self-contained interactive demos, TON wallet API references, and developer examples.' },
        { type: 'paragraph', text: 'Widgets are self-contained HTML. Local interactions run inside the widget. The current Serverless handler registry does not yet accept the Bot API 10.4 widget_query and shared_widget_query update types, so bot round-trips, server-synced state, and wallet query demos are shown as protocol references rather than enabled actions.' },
        { type: 'paragraph', text: 'No seed phrases or private keys are requested or stored.' },
        { type: 'paragraph', text: 'Official Bot API documentation: https://core.telegram.org/bots/api' },
      ] },
    });
  }
}
