import { api } from 'sdk';
import { getStats, recordInspection, registerStart } from '../lib/stats.js';
import { reportFor, stringifyReport, sendReport, shareKeyboard, escapeHtml } from '../lib/inspect.js';
import { createArticle } from '../lib/telegraph.js';

const ADMIN_ID = 1314643983;
const commandName = (text) => String(text || '').trim().split(/\s+/)[0].split('@')[0].toLowerCase();

async function start(message) {
  const user = message.from || {};
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'there';
  let isNew = false;

  try {
    isNew = await registerStart(user.id);
  } catch {
    console.error('IdPullBot start stats unavailable; apply the reviewed database migration.');
  }

  await api.sendMessage({
    chat_id: message.chat.id,
    text: 'Welcome ' + escapeHtml(name) + ' to IdPullBot.\n\nSend any message here to inspect its complete Telegram message data and raw update, or reply to a message with /id. Reports are sent in JavaScript-style code blocks, followed by a shareable Telegraph article link.',
    parse_mode: 'HTML',
  });

  if (message.chat?.type === 'private') {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: 'Share a user or chat to inspect its available ID and details.',
      reply_markup: shareKeyboard(),
    });
  }

  if (isNew && message.chat?.type === 'private') {
    try {
      await api.sendMessage({
        chat_id: ADMIN_ID,
        text: 'New IdPullBot user: ' + name + '\nID: ' + String(user.id || 'unknown') +
          (user.username ? '\nUsername: @' + user.username : ''),
      });
    } catch {
      // A notification failure must not break /start.
    }
  }
}

async function help(message) {
  await api.sendMessage({
    chat_id: message.chat.id,
    text: '<b>IdPullBot</b>\nSend any message here to inspect its full Telegram message and raw update. Reply to a message with /id to inspect the replied-to message. Reports are chunked into JavaScript-style code blocks, followed by a shareable Telegraph link.\n\nUse the private-chat keyboard to share users and chats. In supported groups, invoke @idpullbot by replying to a message for a minimal guest-mode report link.\n/stats — private aggregate statistics (admin only).',
    parse_mode: 'HTML',
    reply_markup: message.chat?.type === 'private' ? shareKeyboard() : undefined,
  });
}

async function sharedUsers(message) {
  const shared = message.users_shared;
  const users = Array.isArray(shared.users) ? shared.users : [];
  const ids = users.map((user) => user.user_id);
  const details = users.map((user) => {
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Name not provided';
    return '• ' + escapeHtml(name) +
      (user.username ? ' (@' + escapeHtml(user.username) + ')' : '') +
      ' — <code>' + user.user_id + '</code>';
  });

  await api.sendMessage({
    chat_id: message.chat.id,
    text: '<b>Shared users</b>\nRequest ID: <code>' + shared.request_id + '</code>\n' +
      (details.length ? details.join('\n') : 'No user IDs returned') +
      '\n\nTelegram only returns the user details available in the share event.',
    parse_mode: 'HTML',
    reply_markup: ids.length
      ? { inline_keyboard: ids.map((id) => [{ text: 'Copy ' + id, copy_text: { text: String(id) } }]) }
      : undefined,
  });
}

async function sharedChat(message) {
  const shared = message.chat_shared;
  const chatId = shared.chat_id;
  let chatDetails = '';

  try {
    const chat = await api.getChat({ chat_id: chatId });
    chatDetails = '\nType: <code>' + escapeHtml(chat.type || 'unknown') + '</code>' +
      (chat.title ? '\nTitle: ' + escapeHtml(chat.title) : '') +
      (chat.username ? '\nUsername: @' + escapeHtml(chat.username) : '');
  } catch {
    // Sharing a chat does not guarantee the bot can query its full details.
  }

  await api.sendMessage({
    chat_id: message.chat.id,
    text: '<b>Shared chat</b>\nRequest ID: <code>' + shared.request_id +
      '</code>\nChat ID: <code>' + chatId + '</code>' + chatDetails,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [[{ text: 'Copy chat ID', copy_text: { text: String(chatId) } }]] },
  });
}

async function showStats(message) {
  if (message.chat?.type !== 'private' || message.from?.id !== ADMIN_ID) return;

  try {
    const stats = await getStats();
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '<b>IdPullBot statistics</b>\nTotal inspections: <code>' + stats.inspections +
        '</code>\nPrivate inspections: <code>' + stats.privateInspections +
        '</code>\nGuest inspections: <code>' + stats.guestInspections +
        '</code>\nTracked users: <code>' + stats.uniqueUsers +
        '</code>\nNew users: <code>' + stats.newUsers + '</code>',
      parse_mode: 'HTML',
    });
  } catch {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: 'Statistics are unavailable until the Serverless database migration is applied.',
    });
  }
}

async function inspectPrivate(message, ctx) {
  if (message.chat?.type !== 'private') return;

  const report = stringifyReport(reportFor(message, ctx?.update || { message }, 'private'));
  try {
    await recordInspection(message.from?.id, 'private');
  } catch {
    console.error('IdPullBot stats unavailable; inspection will continue.');
  }

  await sendReport(api, message.chat.id, report, message.message_id);

  try {
    const title = 'IdPullBot Debug — ' + (message.chat.username || message.chat.first_name || 'Private chat') +
      ' — ' + String(message.message_id || 'unknown');
    const articleUrl = await createArticle(title, report);
    await api.sendMessage({
      chat_id: message.chat.id,
      text: 'Shareable report: ' + articleUrl,
      reply_markup: { inline_keyboard: [[{ text: 'Open Telegraph article', url: articleUrl }]] },
      disable_web_page_preview: true,
    });
  } catch {
    console.error('IdPullBot Telegraph article creation failed.');
    await api.sendMessage({
      chat_id: message.chat.id,
      text: 'The debug chunks were sent, but the Telegraph article could not be created. Ensure the Serverless database migration has been applied.',
    });
  }
}

export default async function (message, ctx) {
  if (message?.users_shared) return sharedUsers(message);
  if (message?.chat_shared) return sharedChat(message);

  const command = commandName(message?.text);
  if (command === '/start') return start(message);
  if (command === '/help' || command === '/about') return help(message);
  if (command === '/stats') return showStats(message);

  return inspectPrivate(message, ctx);
}
