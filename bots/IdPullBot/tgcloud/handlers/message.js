import { api } from 'sdk';
import { getStats, recordInspection, registerStart } from '../lib/stats.js';
import { reportFor, stringifyReport, sendReport, shareKeyboard, escapeHtml } from '../lib/inspect.js';
import { createArticle } from '../lib/telegraph.js';

const ADMIN_ID = 1314643983;
const commandName = (text) => String(text || '').trim().split(/\s+/)[0].split('@')[0].toLowerCase();

function errorMessage(error) {
  return String(error?.description || error?.message || error || 'unknown error').slice(0, 300);
}

async function start(message) {
  const user = message.from || {};
  const name = escapeHtml(user.first_name || 'User');
  let isNew = false;

  try {
    isNew = await registerStart(user.id);
  } catch (error) {
    console.error('IdPullBot start statistics update failed: ' + errorMessage(error));
  }

  // Keep the original welcome layout and wording style. Only the old inline
  // mode instructions are replaced with guest-mode instructions.
  const welcome =
    '👋 Welcome, <b>' + name + '</b>! ✨\n\n' +
    '🆔 <b>Get user and chat IDs</b>\n' +
    'Share a user or chat with the buttons below to get its ID and available details.\n\n' +
    '🔎 <b>Message inspector</b>\n' +
    'Send me any message in private chat to inspect the complete Telegram Message and raw Update. Reply to a message with /id to inspect the replied-to message, including forwarding information, entities, media, stickers, polls, locations, buttons, and other fields Telegram supplies.\n\n' +
    '🌐 <b>Guest mode</b>\n' +
    'Mention @idpullbot in a supported group or supergroup to inspect the message you reply to, or the message containing the mention. Guest replies contain only a compact Telegraph report link to avoid cluttering other chats.\n\n' +
    '📚 <b>Features</b>\n' +
    '• Complete Message and raw Update inspection\n' +
    '• JavaScript-style HTML code output in private chat, split into safe chunks\n' +
    '• Shareable Telegraph report for every inspection\n' +
    '• User and chat sharing, copy-ID buttons, and usage statistics\n\n' +
    'Use the share menu below to instantly share users or chats.';

  await api.sendMessage({
    chat_id: message.chat.id,
    text: welcome,
    parse_mode: 'HTML',
  });

  if (message.chat?.type === 'private') {
    // Restore the original share prompt; do not add a changed input placeholder.
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '<b> 📌 Click a button below to share: </b>',
      parse_mode: 'HTML',
      reply_markup: shareKeyboard(),
    });
  }

  if (isNew && message.chat?.type === 'private') {
    try {
      await api.sendMessage({
        chat_id: ADMIN_ID,
        text: 'New IdPullBot user: ' + (user.first_name || 'User') +
          '\nID: ' + String(user.id || 'unknown') +
          (user.username ? '\nUsername: @' + user.username : ''),
      });
    } catch (error) {
      console.error('IdPullBot admin notification failed: ' + errorMessage(error));
    }
  }
}

async function help(message) {
  await api.sendMessage({
    chat_id: message.chat.id,
    text:
      '<b>IdPullBot</b>\n' +
      'Send any message here to inspect its complete Telegram Message and raw Update. Reply to a message with /id to inspect the replied-to message. Private reports are split into JavaScript-style HTML code blocks and followed by a shareable Telegraph link.\n\n' +
      'In supported groups and supergroups, mention @idpullbot to get a minimal guest-mode response with the Telegraph report link.\n\n' +
      '/me — get your own Telegram ID with a copy button.\n' +
      '/stats — private aggregate statistics (admin only).',
    parse_mode: 'HTML',
    reply_markup: message.chat?.type === 'private' ? shareKeyboard() : undefined,
  });
}

async function me(message) {
  if (message.chat?.type !== 'private') return;

  const userId = message.from?.id;
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    await api.sendMessage({ chat_id: message.chat.id, text: 'Could not determine your Telegram ID.' });
    return;
  }

  await api.sendMessage({
    chat_id: message.chat.id,
    text: '<b>Your Telegram ID</b>\n<code>' + userId + '</code>',
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[{
        text: 'Copy',
        copy_text: { text: String(userId) },
      }]],
    },
  });
}

async function sharedUsers(message) {
  const shared = message.users_shared;
  const users = Array.isArray(shared.users) ? shared.users : [];
  const details = users.map((user) => {
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Name not provided';
    return '• ' + escapeHtml(name) +
      (user.username ? ' (@' + escapeHtml(user.username) + ')' : '') +
      ' — <code>' + user.user_id + '</code>';
  });

  await api.sendMessage({
    chat_id: message.chat.id,
    text: '<b>Shared users</b>\nRequest ID: <code>' + shared.request_id + '</code>\n' +
      (details.length ? details.join('\n') : 'No user IDs returned'),
    parse_mode: 'HTML',
    reply_markup: users.length
      ? { inline_keyboard: users.map((user) => [{ text: 'Copy', copy_text: { text: String(user.user_id) } }]) }
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
  } catch (error) {
    // Telegram may share an ID even when this bot cannot query the chat.
    console.error('IdPullBot getChat for a shared chat failed: ' + errorMessage(error));
  }

  await api.sendMessage({
    chat_id: message.chat.id,
    text: '<b>Shared chat</b>\nRequest ID: <code>' + shared.request_id +
      '</code>\nChat ID: <code>' + chatId + '</code>' + chatDetails,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[{ text: 'Copy', copy_text: { text: String(chatId) } }]],
    },
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
  } catch (error) {
    console.error('IdPullBot statistics retrieval failed: ' + errorMessage(error));
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
  } catch (error) {
    console.error('IdPullBot statistics update failed: ' + errorMessage(error));
  }

  // The complete report is chunked, not summarized or truncated.
  await sendReport(api, message.chat.id, report, message.message_id);

  try {
    const title = 'IdPullBot Debug — ' +
      (message.chat.username || message.chat.first_name || 'Private chat') +
      ' — ' + String(message.message_id || 'unknown');
    const articleUrl = await createArticle(title, report);
    await api.sendMessage({
      chat_id: message.chat.id,
      text: 'Shareable report: ' + articleUrl,
      reply_markup: {
        inline_keyboard: [[{ text: 'Open Article', url: articleUrl }]],
      },
      disable_web_page_preview: true,
    });
  } catch (error) {
    console.error('IdPullBot Telegraph article creation failed: ' + errorMessage(error));
    await api.sendMessage({
      chat_id: message.chat.id,
      text: 'The debug chunks were sent, but the Telegraph article could not be created. Check the saved Telegraph access token and Serverless database migration.',
    });
  }
}

export default async function (message, ctx) {
  if (message?.users_shared) return sharedUsers(message);
  if (message?.chat_shared) return sharedChat(message);

  const command = commandName(message?.text);
  if (command === '/start') return start(message);
  if (command === '/help' || command === '/about') return help(message);
  if (command === '/me') return me(message);
  if (command === '/stats') return showStats(message);

  return inspectPrivate(message, ctx);
}
