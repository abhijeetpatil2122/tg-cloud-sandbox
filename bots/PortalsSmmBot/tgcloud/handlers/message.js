import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { OWNER_IDS } from '../lib/config.js';
import { addAdmin, isAdmin } from '../lib/admins.js';
import { fullName, helpMessage, homeMessage, sendRich, sectionMessage, customerServicesMessage } from '../lib/ui.js';
import { adminSessions } from '../schema.js';
import { transactionHistoryMessage, walletMessage } from '../lib/wallet.js';
import { listTelegramServices, setTelegramServicePrice } from '../lib/provider.js';

function parseCommand(value = '') {
  const match = value.trim().match(/^\/([a-z0-9_]+)(?:@[a-z0-9_]+)?(?:\s+([\s\S]*))?$/i);
  return match ? { command: `/${match[1].toLowerCase()}`, argument: (match[2] || '').trim() } : null;
}

async function sendEmergencyReply(chatId) {
  try {
    await api.sendMessage({
      chat_id: chatId,
      text: 'Portals SMM is temporarily unavailable. Please try /menu again.',
    });
  } catch (error) {
    console.error('PortalsSmmBot emergency reply failed:', error?.description || error);
  }
}

export default async function handleMessage(message) {
  if (!message?.chat?.id || !message?.from?.id) return;
  const chatId = message.chat.id;
  const userId = Number(message.from.id);
  const text = typeof message.text === 'string' ? message.text.trim() : '';

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

    if (text && !text.startsWith('/') && (OWNER_IDS.includes(userId) || await isAdmin(userId))) {
      const pending = await db.select().from(adminSessions)
        .where(eq(adminSessions.userId, userId)).get();

      if (pending?.action === 'add_admin' && OWNER_IDS.includes(userId)) {
        if (!/^\d{5,15}$/.test(text)) {
          await sendRich(chatId, {
            blocks: [
              { type: 'heading', size: 2, text: 'Invalid user ID' },
              { type: 'paragraph', text: 'Send a numeric Telegram user ID containing 5–15 digits, or cancel the action.' },
              { type: 'buttons', buttons: [{ text: 'Cancel', callback_data: 'ps:admin:cancel', style: 'link' }] },
            ],
          });
          return;
        }
        const result = await addAdmin(Number(text), userId);
        await db.delete(adminSessions).where(eq(adminSessions.userId, userId)).run();
        await sendRich(chatId, {
          blocks: [
            { type: 'heading', size: 2, text: result.added ? 'Administrator added' : 'Already registered' },
            { type: 'paragraph', text: result.added ? `Telegram user ${text} can now access the administrator panel.` : 'That account is already an owner or administrator.' },
            { type: 'buttons', buttons: [{ text: '‹ Administrator panel', callback_data: 'ps:admin', style: 'link' }] },
          ],
        });
        return;
      }

      const priceInput = pending?.action?.match(/^set_service_price:(\d{1,12})$/);
      if (priceInput) {
        if (!/^\d{1,9}$/.test(text) || Number(text) <= 0) {
          await sendRich(chatId, {
            blocks: [
              { type: 'heading', size: 2, text: 'Invalid price' },
              { type: 'paragraph', text: 'Send a positive whole number of Portal Points, or cancel.' },
              { type: 'buttons', buttons: [{ text: 'Cancel', callback_data: 'ps:admin:cancel', style: 'link' }] },
            ],
          });
          return;
        }
        await setTelegramServicePrice(Number(priceInput[1]), Number(text));
        await db.delete(adminSessions).where(eq(adminSessions.userId, userId)).run();
        await sendRich(chatId, {
          blocks: [
            { type: 'heading', size: 2, text: 'Price updated' },
            { type: 'paragraph', text: `Service #${priceInput[1]} is now priced at ${Number(text).toLocaleString('en-IN')} Portal Points.` },
            { type: 'buttons', buttons: [{ text: '‹ Telegram services', callback_data: 'ps:admin:services', style: 'link' }] },
          ],
        });
        return;
      }
    }

    // Command parsing is intentionally independent of database-backed features.
    const parsed = parseCommand(text);
    if (!parsed) return;

    if (parsed.command === '/cancel' && (OWNER_IDS.includes(userId) || await isAdmin(userId))) {
      const pending = await db.select().from(adminSessions)
        .where(eq(adminSessions.userId, userId)).get();
      if (pending) {
        await db.delete(adminSessions).where(eq(adminSessions.userId, userId)).run();
        await sendRich(chatId, {
          blocks: [
            { type: 'paragraph', text: 'Administrator action cancelled.' },
            { type: 'buttons', buttons: [{ text: '‹ Administrator panel', callback_data: 'ps:admin', style: 'link' }] },
          ],
        });
      }
      return;
    }

    if (parsed.command === '/start' || parsed.command === '/menu') {
      // The storefront entry point deliberately has no database dependency.
      // Owners are recognized from static configuration; customer menus always load.
      return await sendRich(chatId, homeMessage(fullName(message.from), OWNER_IDS.includes(userId)));
    }

    if (parsed.command === '/services') {
      return await sendRich(chatId, customerServicesMessage(await listTelegramServices(true)));
    }

    const sectionCommands = {
      '/deposit': 'deposit',
      '/orders': 'orders',
      '/referral': 'referral',
      '/support': 'support',
    };
    if (sectionCommands[parsed.command]) {
      return await sendRich(chatId, sectionMessage(sectionCommands[parsed.command]));
    }

    if (parsed.command === '/wallet') {
      return await sendRich(chatId, await walletMessage(userId));
    }

    if (parsed.command === '/history') {
      return await sendRich(chatId, await transactionHistoryMessage(userId, 0));
    }

    if (parsed.command === '/help') {
      return await sendRich(chatId, helpMessage());
    }

    if (parsed.command === '/admin') {
      if (!await isAdmin(userId)) {
        await sendRich(chatId, {
          blocks: [
            { type: 'heading', size: 2, text: 'Access denied' },
            { type: 'paragraph', text: 'This account is not registered as a bot administrator.' },
            { type: 'buttons', buttons: [{ text: '‹ Main menu', callback_data: 'ps:home', style: 'link' }] },
          ],
        });
        return;
      }
      return await sendRich(chatId, {
        blocks: [
          { type: 'heading', size: 2, text: 'Administrator access' },
          { type: 'paragraph', text: 'Open the control panel to manage bot access.' },
          { type: 'buttons', buttons: [{ text: 'Open administrator panel', callback_data: 'ps:admin', style: 'primary' }] },
        ],
      });
    }

    await sendRich(chatId, {
      blocks: [
        { type: 'paragraph', text: 'Unknown command. Use /menu to open the storefront.' },
        { type: 'buttons', buttons: [{ text: '‹ Main menu', callback_data: 'ps:home', style: 'link' }] },
      ],
    });
  } catch (error) {
    console.error('PortalsSmmBot message handler failed:', error?.description || error?.stack || error);
    await sendEmergencyReply(chatId);
  }
}
