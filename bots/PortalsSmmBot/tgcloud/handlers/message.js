import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { sendHome, sendHelp } from '../lib/ui.js';
import { OWNER_IDS } from '../lib/config.js';
import { adminSessions } from '../schema.js';
import { addAdmin, isAdmin } from '../lib/admins.js';

function getCommand(text = '') {
  const [raw = ''] = text.trim().split(/\s+/);
  return raw.split('@', 1)[0].toLowerCase();
}

export default async function handleMessage(payload) {
  // Telegram Serverless passes the Message payload directly, not the outer Update.
  // Accept the wrapped form as a compatibility fallback for local/manual tests.
  const message = payload?.message ?? payload;
  if (!message?.chat?.id || !message?.from?.id) return;
  if (message.chat.type !== 'private') {
    if (message.text?.trim().startsWith('/')) {
      await api.sendMessage({
        chat_id: message.chat.id,
        text: 'Please open the bot in a private chat to use the storefront.',
      });
    }
    return;
  }

  const userId = Number(message.from.id);
  const text = typeof message.text === 'string' ? message.text.trim() : '';
  const pending = await db.select().from(adminSessions)
    .where(eq(adminSessions.userId, userId)).get();

  if (pending?.action === 'add_admin' && text && !text.startsWith('/')) {
    if (!OWNER_IDS.includes(userId)) {
      await db.delete(adminSessions).where(eq(adminSessions.userId, userId)).run();
      return api.sendMessage({
        chat_id: message.chat.id,
        text: 'Only a designated owner can add administrators.',
      });
    }
    if (!/^\d{5,15}$/.test(text)) {
      return api.sendMessage({
        chat_id: message.chat.id,
        text: 'Send a numeric Telegram user ID, or /cancel to stop.',
      });
    }
    const result = await addAdmin(Number(text), userId);
    await db.delete(adminSessions).where(eq(adminSessions.userId, userId)).run();
    return api.sendMessage({
      chat_id: message.chat.id,
      text: result.added
        ? `Administrator ${text} added.`
        : 'That account is already a configured owner or administrator.',
    });
  }

  const command = getCommand(text);
  if (command === '/cancel' && pending) {
    await db.delete(adminSessions).where(eq(adminSessions.userId, userId)).run();
    return api.sendMessage({ chat_id: message.chat.id, text: 'Admin action cancelled.' });
  }
  if (command === '/start' || command === '/menu') {
    return sendHome(
      message.chat.id,
      message.from.first_name || 'there',
      await isAdmin(userId),
    );
  }
  if (command === '/help') return sendHelp(message.chat.id);
  if (command === '/admin') {
    if (!await isAdmin(userId)) return;
    return api.sendMessage({
      chat_id: message.chat.id,
      text: 'Open the administrator panel:',
      reply_markup: {
        inline_keyboard: [[{ text: 'Open admin panel', callback_data: 'ps:admin' }]],
      },
    });
  }
  if (text.startsWith('/')) {
    return api.sendMessage({
      chat_id: message.chat.id,
      text: 'Unknown command. Use /menu to open the storefront or /help for assistance.',
    });
  }
}
