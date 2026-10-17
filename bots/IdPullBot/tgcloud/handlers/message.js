import { api } from 'sdk';
import { getStats, recordInspection, registerStart } from '../lib/stats.js';
import { reportFor, stringifyReport, sendReport, shareKeyboard, escapeHtml } from '../lib/inspect.js';
import { createArticle, saveTelegraphToken, testTelegraph } from '../lib/telegraph.js';
import { TELEGRAPH_ACCESS_TOKEN } from '../lib/config.js';

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
        text: 'Copy ID',
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

  // Keep the original welcome copy, expandable blockquote, custom emoji,
  // primary inline button, and layout. Only the removed inline-mode wording
  // is replaced with the guest-mode instruction.
  const welcome =
    'Welcome, <b>' + firstName + '</b>! ' + customEmoji('5040016479722931047', '✨') + '\n\n' +
    '<i>Use this bot to extract Telegram IDs and debug message data:</i>\n\n' +
    '<blockquote expandable>' +
    '• ' + customEmoji('6024112973226709843', '📣') + ' Forward channel/user messages to get IDs\n' +
    '• ' + customEmoji('5359441070201513074', '🎭') + ' Send stickers to get file_id\n' +
    '• ' + customEmoji('5258513401784573443', '👥') + ' Add bot to groups to get group & migration IDs\n' +
    '• ' + customEmoji('5474371208176737086', '✉️') + ' Send any message/media to extract detailed info\n' +
    '• ' + customEmoji('5039649904264217620', '🔎') + ' Mention <code>@idpullbot</code> in supported chats to inspect a message with guest mode\n\n' +
    '<b>Features:</b>\n' +
    '- ' + customEmoji('5040036030414062506', '💬') + ' Works in chats and guest mode\n' +
    '- ' + customEmoji('5039649904264217620', '🔍') + ' Extracts IDs for users, chats, messages, media & custom emojis' +
    '</blockquote>\n\n' +
    '<b>' + customEmoji('5429633836684157942', '⚡') + ' Use the share menu below to instantly share users or chats.</b>';

  await api.sendMessage({
    chat_id: message.chat.id,
    text: welcome,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [[{
        text: 'Get my info',
        style: 'primary',
        icon_custom_emoji_id: '5258011929993026890',
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
      const stats = await getStats();
      const username = user.username ? ' [@' + escapeHtml(user.username) + ']' : '';
      await api.sendMessage({
        chat_id: ADMIN_ID,
        text:
          '➕ <b>New User Started Bot</b>\n\n' +
          '👤 <b>User:</b> <a href="tg://user?id=' + user.id + '">' + firstName + '</a>' + username +
          '\n🆔 <b>User ID:</b> <code>' + user.id + '</code>' +
          '\n🌍 <b>Total Users:</b> <b>' + stats.uniqueUsers + '</b>',
        parse_mode: 'HTML',
        disable_web_page_preview: true,
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
  const userId = message.from?.id;
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    await api.sendMessage({ chat_id: message.chat.id, text: 'Could not determine your Telegram ID.' });
    return;
  }
  await sendMe(message.chat.id, userId);
}

async function testTelegraphCommand(message) {
  if (message.chat?.type !== 'private' || message.from?.id !== ADMIN_ID) return;

  try {
    const result = await testTelegraph();
    const count = Number.isFinite(result.pageCount) ? '\nPages before test: ' + result.pageCount : '';
    await api.sendMessage({
      chat_id: message.chat.id,
      text: 'Telegraph API test succeeded.\nAccount: ' + escapeHtml(result.shortName) + count + '\nTest article: ' + result.url,
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [[{ text: 'Open Test Article', url: result.url }]],
      },
    });
  } catch (error) {
    const raw = errorMessage(error);
    const match = raw.match(/TELEGRAPH_API_ERROR:([^:]+):HTTP_(\d+)/);
    const detail = match ? match[1] + ' (HTTP ' + match[2] + ')' : raw;
    console.error('IdPullBot Telegraph live test failed: ' + detail);
    await api.sendMessage({
      chat_id: message.chat.id,
      text: 'Telegraph API test failed: ' + escapeHtml(detail),
    });
  }
}

async function setTelegraph(message) {
  if (message.chat?.type !== 'private' || message.from?.id !== ADMIN_ID) return;

  if (TELEGRAPH_ACCESS_TOKEN) {
    try {
      await api.deleteMessage({ chat_id: message.chat.id, message_id: message.message_id });
    } catch {}
    await api.sendMessage({
      chat_id: message.chat.id,
      text: 'Telegraph is already configured.',
    });
    return;
  }

  const token = String(message.text || '').trim().split(/\s+/).slice(1).join('').trim();
  if (!token) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: 'Usage: <code>/settelegraph YOUR_TELEGRAPH_ACCESS_TOKEN</code>\nThe token is stored in this bot’s Serverless database.',
      parse_mode: 'HTML',
    });
    return;
  }

  try {
    await saveTelegraphToken(token);
    // Delete the command containing the token from the private chat when
    // Telegram permits it. Never log or echo the token.
    try {
      await api.deleteMessage({ chat_id: message.chat.id, message_id: message.message_id });
    } catch {
      // Best effort only; the token is never included in a bot reply or log.
    }
    await api.sendMessage({
      chat_id: message.chat.id,
      text: 'Telegraph is ready.',
    });
  } catch (error) {
    try {
      await api.deleteMessage({ chat_id: message.chat.id, message_id: message.message_id });
    } catch {}
    console.error('IdPullBot Telegraph setup failed: ' + errorMessage(error));
    await api.sendMessage({
      chat_id: message.chat.id,
      text: 'Telegraph setup could not be completed. Please try again.',
    });
  }
}

async function sharedUsers(message) {
  const shared = message.users_shared;
  const users = Array.isArray(shared.users) ? shared.users : [];
  const details = users.map((user) => {
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User';
    return '• ' + escapeHtml(name) +
      (user.username ? ' (@' + escapeHtml(user.username) + ')' : '') +
      ' — <code>' + user.user_id + '</code>';
  });

  await api.sendMessage({
    chat_id: message.chat.id,
    text: '<b>Shared users</b>\n' + (details.length ? details.join('\n') : 'No user IDs returned'),
    parse_mode: 'HTML',
    reply_markup: users.length
      ? { inline_keyboard: Array.from({ length: Math.ceil(users.length / 2) }, (_, row) => users.slice(row * 2, row * 2 + 2).map((user) => ({ text: 'Copy ID', copy_text: { text: String(user.user_id) } }))) }
      : undefined,
  });
}

async function sharedChat(message) {
  const shared = message.chat_shared || {};
  const chatId = shared.chat_id;
  let title = shared.title || '';
  let username = shared.username || '';
  let type = '';

  // ChatShared now supplies title and username when the request button asked
  // for them. Use those update fields first; getChat is only a fallback.
  if (!title || !username) {
    try {
      const chat = await api.getChat({ chat_id: chatId });
      title = title || chat.title || chat.first_name || '';
      username = username || chat.username || '';
      type = chat.type || '';
    } catch (error) {
      // The bot may not have access to a chat that was just shared. The ID
      // and any metadata present in ChatShared are still valid.
      console.info('IdPullBot could not enrich a shared chat: ' + errorMessage(error));
    }
  }

  const lines = ['<b>Shared chat</b>'];
  if (title) lines.push('Title: ' + escapeHtml(title));
  if (username) lines.push('Username: @' + escapeHtml(username));
  if (type) lines.push('Type: <code>' + escapeHtml(type) + '</code>');
  lines.push('Chat ID: <code>' + chatId + '</code>');

  await api.sendMessage({
    chat_id: message.chat.id,
    text: lines.join('\n'),
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[{ text: 'Copy ID', copy_text: { text: String(chatId) } }]],
    },
  });
}


async function guestStatus(message) {
  if (message.chat?.type !== 'private' || message.from?.id !== ADMIN_ID) return;

  try {
    const bot = await api.getMe();
    const enabled = bot?.supports_guest_queries === true;
    await api.sendMessage({
      chat_id: message.chat.id,
      text: enabled
        ? 'Guest mode is enabled for @idpullbot.'
        : 'Guest mode is not enabled for @idpullbot. Enable Guest Mode in BotFather, then test again.',
    });
  } catch (error) {
    console.error('IdPullBot guest-mode status check failed: ' + errorMessage(error));
    await api.sendMessage({
      chat_id: message.chat.id,
      text: 'Guest-mode status could not be checked right now.',
    });
  }
}

async function showStats(message) {
  if (message.chat?.type !== 'private' || message.from?.id !== ADMIN_ID) return;

  try {
    const stats = await getStats();
    const rows = [
      ['Metric', 'Count'],
      ['Total inspections', String(stats.inspections)],
      ['Private inspections', String(stats.privateInspections)],
      ['Guest inspections', String(stats.guestInspections)],
      ['Tracked users', String(stats.uniqueUsers)],
      ['New users', String(stats.newUsers)],
    ];

    await api.sendRichMessage({
      chat_id: message.chat.id,
      rich_message: {
        blocks: [
          { type: 'heading', text: 'IdPullBot statistics', size: 3 },
          {
            type: 'table',
            cells: rows.map((row, rowIndex) => row.map((value) => ({
              text: value,
              ...(rowIndex === 0 ? { is_header: true } : {}),
              align: rowIndex === 0 ? 'left' : 'right',
            }))),
            is_bordered: false,
            is_striped: false,
            is_compact: false,
          },
        ],
      },
    });
  } catch (error) {
    console.error('IdPullBot statistics retrieval failed: ' + errorMessage(error));
    await api.sendMessage({
      chat_id: message.chat.id,
      text: 'Statistics are unavailable right now. Please try again shortly.',
    });
  }
}

async function inspectPrivate(message, ctx) {
  if (message.chat?.type !== 'private') return;

  // ctx.update is the complete Telegram Update; reportFor keeps it intact,
  // alongside the complete Message and replied-to target (when present).
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
      text: 'The debug report was sent, but the shareable article could not be created right now.',
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
  if (command === '/testtelegraph') return testTelegraphCommand(message);\n  if (command === '/settelegraph') return setTelegraph(message);
  if (command === '/gueststatus') return guestStatus(message);
  if (command === '/stats') return showStats(message);

  return inspectPrivate(message, ctx);
}
