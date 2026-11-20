import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { sendHome, sendHelp } from '../lib/ui.js';
import { adminSessions } from '../schema.js';
import { addAdmin, isAdmin, isOwner, listAdmins, removeAdmin } from '../lib/admins.js';

async function answerCallback(id, text = '') {
  const params = { callback_query_id: id };
  if (text) params.text = text;
  await api.answerCallbackQuery(params);
}

async function showAdminPanel(chatId, messageId = null, canManage = true) {
  const admins = await listAdmins();
  const rich = { blocks: [
    { type: 'heading', size: 1, text: 'Administrator panel' },
    { type: 'paragraph', text: 'Manage authorized staff for this bot. Designated owners are protected and cannot be removed.' },
    { type: 'paragraph', text: `Active administrators: ${admins.length}` },
    { type: 'paragraph', text: 'Owners: 6522801911, 1314643983' },
  ] };
  const rows = canManage
    ? [
        [{ text: 'Add administrator', callback_data: 'ps:admin:add', style: 'success' }],
        [{ text: 'Remove administrator', callback_data: 'ps:admin:remove' }],
        [{ text: '‹ Main menu', callback_data: 'ps:home' }],
      ]
    : [[{ text: '‹ Main menu', callback_data: 'ps:home' }]];

  if (messageId) {
    return api.editMessageText({
      chat_id: chatId,
      message_id: messageId,
      rich_message: rich,
      reply_markup: { inline_keyboard: rows },
    });
  }
  return api.sendRichMessage({
    chat_id: chatId,
    rich_message: rich,
    reply_markup: { inline_keyboard: rows },
  });
}

async function showAdminRemoval(chatId, messageId) {
  const admins = await listAdmins();
  const removable = admins.filter(id => !isOwner(id));
  const rows = removable.map(id => [{
    text: `Remove ${id}`,
    callback_data: `ps:admin:del:${id}`,
    style: 'danger',
  }]);
  rows.push([{ text: '‹ Back to admin panel', callback_data: 'ps:admin' }]);
  return api.editMessageText({
    chat_id: chatId,
    message_id: messageId,
    text: removable.length
      ? 'Choose an administrator to remove:'
      : 'There are no removable administrators. The two designated owners are protected.',
    reply_markup: { inline_keyboard: rows },
  });
}

export default async function handleCallbackQuery(payload) {
  // Telegram Serverless passes the CallbackQuery payload directly, not the outer Update.
  // Accept the wrapped form as a compatibility fallback for local/manual tests.
  const query = payload?.callback_query ?? payload;
  if (!query?.id || !query?.from?.id) return;

  const message = query.message;
  if (!message?.chat?.id || message.chat.type !== 'private' || message.chat.id !== query.from.id) {
    await answerCallback(query.id, 'Open the bot in a private chat.');
    return;
  }

  const data = String(query.data || '');
  const userId = Number(query.from.id);

  if (data.startsWith('ps:admin')) {
    if (!await isAdmin(userId)) {
      return answerCallback(query.id, 'Not authorized.');
    }
    if (data !== 'ps:admin' && !isOwner(userId)) {
      return answerCallback(query.id, 'Only designated owners can manage administrators.');
    }

    await answerCallback(query.id);
    if (data === 'ps:admin' || data === 'ps:admin:home') {
      return showAdminPanel(message.chat.id, message.message_id, isOwner(userId));
    }
    if (data === 'ps:admin:add') {
      await db.insert(adminSessions)
        .values({ userId, action: 'add_admin', createdAt: new Date() })
        .onConflictDoUpdate({
          target: adminSessions.userId,
          set: { action: 'add_admin', createdAt: new Date() },
        }).run();
      return api.sendMessage({
        chat_id: message.chat.id,
        text: 'Send the numeric Telegram user ID to add. Send /cancel to stop.',
      });
    }
    if (data === 'ps:admin:remove') {
      return showAdminRemoval(message.chat.id, message.message_id);
    }
    const match = data.match(/^ps:admin:del:(\d+)$/);
    if (match) {
      const result = await removeAdmin(Number(match[1]));
      await api.sendMessage({
        chat_id: message.chat.id,
        text: result.removed
          ? `Administrator ${match[1]} removed.`
          : 'That account is protected or is not a removable database administrator.',
      });
      return showAdminPanel(message.chat.id);
    }
  }

  await answerCallback(query.id);
  if (data === 'ps:home') {
    return sendHome(message.chat.id, query.from.first_name || 'there', await isAdmin(userId));
  }
  if (data === 'ps:help') return sendHelp(message.chat.id);

  const labels = {
    'ps:services': 'The service catalogue is being prepared.',
    'ps:deposit': 'Stars deposits are not enabled yet.',
    'ps:wallet': 'Your Portal Points wallet will appear here.',
    'ps:orders': 'You do not have any orders yet.',
    'ps:referral': 'The referral programme is being prepared.',
    'ps:support': 'Support details will be published here.',
  };
  return api.sendMessage({
    chat_id: message.chat.id,
    text: labels[data] || 'This menu action is not available yet.',
    reply_markup: {
      inline_keyboard: [[{ text: '‹ Main menu', callback_data: 'ps:home' }]],
    },
  });
}
