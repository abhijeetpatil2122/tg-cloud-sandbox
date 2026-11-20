import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { sendHome, sendHelp } from '../lib/ui.js';
import { OWNER_IDS } from '../lib/config.js';
import { adminSessions } from '../schema.js';
import { addAdmin, isAdmin } from '../lib/admins.js';

function getCommand(text = '') {
  const [raw = ''] = text.trim().split(/\\s+/);
  return raw.split('@', 1)[0].toLowerCase();
}

export default async function handleMessage(payload) {
  // Serverless passes the Message itself, not the outer Update.
  const message = payload?.message ?? payload;
  if (!message?.chat?.id || !message?.from?.id) return;

  const chatId = message.chat.id;
  const userId = Number(message.from.id);
  const text = typeof message.text === 'string' ? message.text.trim() : '';
  const command = getCommand(text);

  try {
    if (message.chat.type !== 'private') {
      if (text.startsWith('/')) {
        await api.sendMessage({
          chat_id: chatId,
          text: 'Please open the bot in a private chat to use the storefront.',
        });
      }
      return;
    }

    // Admin-session storage is only needed for an owner's pending text input.
    // Do not make every ordinary command depend on this table being readable.
    let pending = null;
    if (OWNER_IDS.includes(userId) && text && !text.startsWith('/')) {
      pending = await db.select().from(adminSessions)
        .where(eq(adminSessions.userId, userId)).get();
    }

    if (pending?.action === 'add_admin' && text) {
      if (!/^\\d{5,15}$/.test(text)) {
        return api.sendMessage({
          chat_id: chatId,
          text: 'Send a numeric Telegram user ID, or /cancel to stop.',
        });
      }
      const result = await addAdmin(Number(text), userId);
      await db.delete(adminSessions).where(eq(adminSessions.userId, userId)).run();
      return api.sendMessage({
        chat_id: chatId,
        text: result.added
          ? `Administrator ${text} added.`
          : 'That account is already a configured owner or administrator.',
      });
    }

    if (command === '/cancel' && OWNER_IDS.includes(userId)) {
      const session = await db.select().from(adminSessions)
        .where(eq(adminSessions.userId, userId)).get();
      if (session) {
        await db.delete(adminSessions).where(eq(adminSessions.userId, userId)).run();
        return api.sendMessage({ chat_id: chatId, text: 'Admin action cancelled.' });
      }
    }

    if (command === '/start' || command === '/menu') {
      // Owners are known admins from static configuration; a database outage
      // must not prevent them from opening the storefront.
      let showAdmin = OWNER_IDS.includes(userId);
      if (!showAdmin) {
        try {
          showAdmin = await isAdmin(userId);
        } catch (error) {
          console.error('PortalsSmmBot admin lookup failed:', error?.description || error);
        }
      }
      return await sendHome(chatId, message.from.first_name || 'there', showAdmin);
    }

    if (command === '/help') return await sendHelp(chatId);

    if (command === '/admin') {
      if (!await isAdmin(userId)) return;
      return await api.sendMessage({
        chat_id: chatId,
        text: 'Open the administrator panel:',
        reply_markup: {
          inline_keyboard: [[{ text: 'Open admin panel', callback_data: 'ps:admin' }]],
        },
      });
    }

    if (text.startsWith('/')) {
      return await api.sendMessage({
        chat_id: chatId,
        text: 'Unknown command. Use /menu to open the storefront or /help for assistance.',
      });
    }
  } catch (error) {
    console.error('PortalsSmmBot message handler failed:', error?.description || error?.stack || error);
    try {
      return await api.sendMessage({
        chat_id: chatId,
        text: 'The storefront encountered a temporary error. Please try /menu again.',
      });
    } catch (replyError) {
      console.error('PortalsSmmBot error reply failed:', replyError?.description || replyError);
    }
  }
}

// Keep this handler under the PortalsSmmBot deployment and webhook diagnostics gate.

// CI deployment also exercises the handler's non-admin authorization path.
