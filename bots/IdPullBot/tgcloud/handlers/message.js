import { api } from 'sdk';
import { getStats, recordInspection, registerStart } from '../lib/stats.js';
import { reportFor, stringifyReport, sendReport, shareKeyboard, escapeHtml } from '../lib/inspect.js';
import { createArticle } from '../lib/telegraph.js';

const ADMIN_ID = 1314643983;
const commandName = (text) => String(text || '').trim().split(/\s+/)[0].split('@')[0].toLowerCase();
const customEmoji = (id, emoji) => '<tg-emoji emoji-id="' + id + '">' + emoji + '</tg-emoji>';

function errorMessage(error) {
  return String(error?.description || error?.message || error || 'unknown error').slice(0, 300);
}

async function sendMe(chatId, userId) {
  await api.sendMessage({
    chat_id: chatId,
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

async function start(message) {
  const user = message.from || {};
  const firstName = escapeHtml(user.first_name || 'User');
  let isNew = false;

  try {
    isNew = await registerStart(user.id);
  } catch (error) {
    console.error('IdPullBot start statistics update failed: ' + errorMessage(error));
  }

  // Preserve the original BB welcome sections and instructions; only the
  // inline-mode line is replaced with the guest-mode equivalent.
  const welcome =
    '👋 Welcome, <b>' + firstName + '</b>! ' + customEmoji('5040016479722931047', '✨') + '\n\n' +
    '<i>Use this bot to get IDs for Telegram entities:</i>\n' +
    '• ' + customEmoji('6024112973226709843', '📣') + ' Forward channel/user messages for channel or user IDs\n' +
    '• ' + customEmoji('5359441070201513074', '🎭') + ' Send stickers to get their file_id\n' +
    '• ' + customEmoji('5258513401784573443', '👥') + ' Add bot to groups to get group and migration IDs\n' +
    '• ' + customEmoji('5474371208176737086', '✉️') + ' Send any message/media in chats to extract detailed info (user, message, chat, media IDs)\n' +
    '• ' + customEmoji('5039649904264217620', '🔍') + ' Mention <code>@idpullbot</code> in supported groups or supergroups to inspect the replied-to message or the message containing the mention\n\n' +
    customEmoji('5429633836684157942', '⚡') + ' <b>Features</b>\n' +
    '• ' + customEmoji('5040036030414062506', '💬') + ' Works in chats and guest mode\n' +
    '• ' + customEmoji('5039649904264217620', '🔍') + ' Extracts IDs for users, chats, messages, media & custom emojis\n\n' +
    customEmoji('5429633836684157942', '⚡') + ' Use the share menu below to instantly share users or chats.';

  await api.sendMessage({
    chat_id: message.chat.id,
    text: welcome,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[{
        text: 'Get my info',
        style: 'primary',
        callback_data: 'idpull_me',
      }]],
    },
  });

  if (message.chat?.type === 'private') {
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
  await sendMe(message.chat.id, userId);
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

// Keep this handler as the private-chat entry point; guest requests use guest_message.js.
