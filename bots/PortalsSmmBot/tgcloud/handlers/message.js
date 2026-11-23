import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { OWNER_IDS, FEATURES } from '../lib/config.js';
import { addAdmin, isAdmin } from '../lib/admins.js';
import { fullName, helpMessage, homeMessage, sendRich, sectionMessage, customerServicesMessage, serviceSetupGuideMessage, vpnUnavailableMessage } from '../lib/ui.js';
import { adminSessions, userSessions } from '../schema.js';
import { transactionHistoryMessage, walletMessage } from '../lib/wallet.js';
import { listTelegramServices, setTelegramServicePrice } from '../lib/provider.js';
import { createStarsInvoice, depositMessage, depositUnavailableMessage, handleSuccessfulPayment, adminRefundsMessage, refundPreviewMessage, hasAcceptedTerms, termsAcceptanceMessage, termsMessage, adminPaymentsMessage } from '../lib/payments.js';
import { myOrdersMessage } from '../lib/orders.js';
import { resetPreviewMessage } from '../lib/reset.js';
import { trackUser, isUserBanned, adminStatsMessage, adjustUserBalance, setUserBanned } from '../lib/users.js';

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
    if (message.chat.type === 'private') await trackUser(message.from, message.chat.type);
    if (message.successful_payment) {
      await handleSuccessfulPayment(message);
      return;
    }

    if (await isUserBanned(userId) && !await isAdmin(userId)) {
      await sendRich(chatId, { blocks: [
        { type: 'heading', size: 1, text: 'Access restricted' },
        { type: 'paragraph', text: 'This account is currently restricted from using the storefront. Contact support if you believe this is a mistake.' },
      ] });
      return;
    }

    if (message.chat.type !== 'private') {
      if (text.startsWith('/')) {
        await api.sendMessage({
          chat_id: chatId,
          text: 'Please open the bot in a private chat to use the storefront.',
        });
      }
      return;
    }

    if (text && !text.startsWith('/')) {
      const userPending = await db.select().from(userSessions).where(eq(userSessions.userId, userId)).get();
      if (userPending?.action === 'custom_deposit') {
        const amount = Number(text);
        if (!/^\\d{1,6}$/.test(text) || !Number.isSafeInteger(amount) || amount < 1 || amount > 100000) {
          await sendRich(chatId, { blocks: [
            { type: 'heading', size: 2, text: 'Invalid Stars amount' },
            { type: 'paragraph', text: 'Send a whole number from 1 to 100,000 Stars.' },
            { type: 'buttons', buttons: [{ text: 'Cancel', callback_data: 'ps:deposit:cancel', style: 'link' }] },
          ] });
          return;
        }
        await db.delete(userSessions).where(eq(userSessions.userId, userId)).run();
        try {
          await createStarsInvoice(userId, chatId, amount);
          await sendRich(chatId, { blocks: [
            { type: 'heading', size: 1, text: '⭐ Custom invoice created' },
            { type: 'paragraph', text: amount + ' Stars · ' + (amount / 80).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + ' USD wallet credit. Your balance is updated only after Telegram confirms payment.' },
            { type: 'buttons', buttons: [{ text: '‹ Deposit options', callback_data: 'ps:deposit', style: 'link' }] },
          ] });
        } catch (error) {
          await sendRich(chatId, { blocks: [
            { type: 'heading', size: 1, text: '⭐ Deposit not started' },
            { type: 'paragraph', text: error?.message || 'The invoice could not be created. Please try again.' },
            { type: 'buttons', buttons: [{ text: '‹ Deposit options', callback_data: 'ps:deposit', style: 'link' }] },
          ] });
        }
        return;
      }
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

      const balanceInput = pending?.action?.match(/^balance_(add|remove)$/);
      if (balanceInput) {
        const match = text.match(/^(\d{5,15})\s+(\d{1,9})(?:\s+([\s\S]{1,120}))?$/);
        if (!match) {
          await sendRich(chatId, { blocks: [
            { type: 'heading', size: 2, text: 'Invalid balance adjustment' },
            { type: 'paragraph', text: 'Send: USER_ID AMOUNT followed by an optional short reason. Example: 123456789 50 correction' },
            { type: 'buttons', buttons: [{ text: 'Cancel', callback_data: 'ps:admin:cancel', style: 'link' }] },
          ] });
          return;
        }
        const result = await adjustUserBalance({
          userId: Number(match[1]), amount: Number(match[2]), direction: balanceInput[1],
          adminId: userId, reason: match[3] || '',
        });
        await db.delete(adminSessions).where(eq(adminSessions.userId, userId)).run();
        await sendRich(chatId, { blocks: [
          { type: 'heading', size: 2, text: 'Balance updated' },
          { type: 'table', is_bordered: true, is_compact: true, cells: [
            [{ text: 'Field', is_header: true }, { text: 'Value', is_header: true }],
            [{ text: 'Customer ID' }, { text: String(result.userId), align: 'right' }],
            [{ text: 'Adjustment' }, { text: '$' + result.points + ' ' + result.direction, align: 'right' }],
            [{ text: 'Ledger transaction' }, { text: '#' + result.transactionId, align: 'right' }],
          ] },
          { type: 'buttons', buttons: [{ text: '‹ Administrator panel', callback_data: 'ps:admin', style: 'link' }] },
        ] });
        try { await api.sendMessage({ chat_id: result.userId, text: 'An administrator ' + result.direction + ' ' + '$' + result.points + ' to your wallet.' }); } catch {}
        return;
      }

      const banInput = pending?.action?.match(/^user_(ban|unban)$/);
      if (banInput) {
        if (!/^\d{5,15}$/.test(text)) {
          await sendRich(chatId, { blocks: [
            { type: 'heading', size: 2, text: 'Invalid Telegram user ID' },
            { type: 'paragraph', text: 'Send a numeric Telegram user ID containing 5–15 digits, or cancel.' },
            { type: 'buttons', buttons: [{ text: 'Cancel', callback_data: 'ps:admin:cancel', style: 'link' }] },
          ] });
          return;
        }
        let result;
        try {
          result = await setUserBanned(Number(text), banInput[1] === 'ban', userId);
        } catch (banError) {
          await sendRich(chatId, { blocks: [
            { type: 'heading', size: 2, text: 'User moderation unavailable' },
            { type: 'paragraph', text: banError?.message || 'The user registry is not ready. Apply the reviewed database migration first.' },
            { type: 'buttons', buttons: [{ text: 'Cancel', callback_data: 'ps:admin:cancel', style: 'link' }] },
          ] });
          return;
        }
        await db.delete(adminSessions).where(eq(adminSessions.userId, userId)).run();
        await sendRich(chatId, { blocks: [
          { type: 'heading', size: 2, text: result.banned ? 'User banned' : 'User unbanned' },
          { type: 'paragraph', text: 'Telegram user ' + result.userId + (result.banned ? ' can no longer use the storefront.' : ' may use the storefront again.') },
          { type: 'buttons', buttons: [{ text: '‹ Administrator panel', callback_data: 'ps:admin', style: 'link' }] },
        ] });
        try { await api.sendMessage({ chat_id: result.userId, text: result.banned ? 'Your access to Portals SMM has been restricted by an administrator.' : 'Your access to Portals SMM has been restored.' }); } catch {}
        return;
      }

      const priceInput = pending?.action?.match(/^set_service_price:(\d{1,12})$/);
      if (priceInput) {
        if (!/^\d{1,9}$/.test(text) || Number(text) <= 0) {
          await sendRich(chatId, {
            blocks: [
              { type: 'heading', size: 2, text: 'Invalid price' },
              { type: 'paragraph', text: 'Send a positive whole USD amount, or cancel.' },
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
            { type: 'paragraph', text: 'Service #' + priceInput[1] + ' is now priced at $' + Number(text).toLocaleString('en-US') + '.' },
            { type: 'buttons', buttons: [{ text: '‹ Telegram services', callback_data: 'ps:admin:services', style: 'link' }] },
          ],
        });
        return;
      }
    }

    // Command parsing is intentionally independent of database-backed features.
    const parsed = parseCommand(text);
    if (!parsed) return;

    if (parsed.command === '/cancel') {
      const userPending = await db.select().from(userSessions).where(eq(userSessions.userId, userId)).get();
      if (userPending) await db.delete(userSessions).where(eq(userSessions.userId, userId)).run();
      if (OWNER_IDS.includes(userId) || await isAdmin(userId)) {
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
      }
      if (userPending) await sendRich(chatId, { blocks: [
        { type: 'paragraph', text: 'Custom deposit cancelled.' },
        { type: 'buttons', buttons: [{ text: '‹ Deposit options', callback_data: 'ps:deposit', style: 'link' }] },
      ] });
      return;
    }

    if (parsed.command === '/start' || parsed.command === '/menu') {
        return await sendRich(chatId, homeMessage(fullName(message.from), OWNER_IDS.includes(userId) || await isAdmin(userId)));
    }

    if (parsed.command === '/deposit') {
      if (!parsed.argument) {
        if (!FEATURES.depositsEnabled) return await sendRich(chatId, depositUnavailableMessage());
        return await sendRich(chatId, await hasAcceptedTerms(userId) ? depositMessage() : termsAcceptanceMessage());
      }
      if (!await hasAcceptedTerms(userId)) return await sendRich(chatId, termsAcceptanceMessage());
      const amount = Number(parsed.argument);
      try {
        await createStarsInvoice(userId, chatId, amount);
      } catch (error) {
        await sendRich(chatId, {
          blocks: [
            { type: 'heading', size: 1, text: '⭐ Deposit not started' },
            { type: 'paragraph', text: error?.message || 'The invoice could not be created. Please try again.' },
            { type: 'buttons', buttons: [{ text: '‹ Deposit options', callback_data: 'ps:deposit', style: 'link' }] },
          ],
        });
      }
      return;
    }

    if (parsed.command === '/paysupport') return await sendRich(chatId, sectionMessage('support'));

    if (parsed.command === '/terms') return await sendRich(chatId, termsMessage());
    if (parsed.command === '/vpn') return await sendRich(chatId, vpnUnavailableMessage());

    if (parsed.command === '/services') {
      try {
        return await sendRich(chatId, customerServicesMessage(await listTelegramServices(true)));
      } catch {
        return await sendRich(chatId, customerServicesMessage([]));
      }
    }

    if (parsed.command === '/orders' || parsed.command === '/servicehistory') {
      try {
        return await sendRich(chatId, await myOrdersMessage(userId, 0));
      } catch (error) {
        console.error('Order history unavailable:', error?.description || error?.message || error);
        return await sendRich(chatId, sectionMessage('orders'));
      }
    }

    const sectionCommands = {
      '/deposit': 'deposit',
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

    if (parsed.command === '/refund') {
      if (message.chat.type !== 'private') return await sendRich(chatId, {
        blocks: [
          { type: 'heading', size: 1, text: '🔒 Private chat required' },
          { type: 'paragraph', text: 'Please open Portals SMM in a private chat to use administrator payment tools.' },
        ],
      });
      if (!await isAdmin(userId)) {
        return await sendRich(chatId, {
          blocks: [
            { type: 'heading', size: 1, text: 'Access denied' },
            { type: 'paragraph', text: 'Only administrators can review Stars refunds.' },
          ],
        });
      }
      if (parsed.argument && /^\d{1,12}$/.test(parsed.argument)) {
        return await sendRich(chatId, await refundPreviewMessage(Number(parsed.argument)));
      }
      return await sendRich(chatId, await adminRefundsMessage(0));
    }

    if (parsed.command === '/payments') {
      if (message.chat.type !== 'private') return await sendRich(chatId, {
        blocks: [
          { type: 'heading', size: 1, text: '🔒 Private chat required' },
          { type: 'paragraph', text: 'Please open Portals SMM in a private chat to use administrator payment tools.' },
        ],
      });
      if (!await isAdmin(userId)) return await sendRich(chatId, {
        blocks: [
          { type: 'heading', size: 1, text: 'Access denied' },
          { type: 'paragraph', text: 'Only administrators can view payment records.' },
        ],
      });
      return await sendRich(chatId, await adminPaymentsMessage('confirmed', 0));
    }

    if (parsed.command === '/resetdb') {
      if (message.chat.type !== 'private') return await sendRich(chatId, {
        blocks: [
          { type: 'heading', size: 1, text: '🔒 Private chat required' },
          { type: 'paragraph', text: 'Please open Portals SMM in a private chat to use administrator payment tools.' },
        ],
      });
      if (!await isAdmin(userId)) return await sendRich(chatId, {
        blocks: [
          { type: 'heading', size: 1, text: 'Access denied' },
          { type: 'paragraph', text: 'Only administrators can reset test data.' },
        ],
      });
      return await sendRich(chatId, await resetPreviewMessage());
    }

    if (parsed.command === '/servicesetup') {
      if (!await isAdmin(userId)) return await sendRich(chatId, {
        blocks: [
          { type: 'heading', size: 2, text: 'Access denied' },
          { type: 'paragraph', text: 'This setup guide is available to administrators only.' },
          { type: 'buttons', buttons: [{ text: '‹ Main menu', callback_data: 'ps:home', style: 'link' }] },
        ],
      });
      return await sendRich(chatId, serviceSetupGuideMessage());
    }

    if (parsed.command === '/stats') {
      if (!await isAdmin(userId)) return await sendRich(chatId, {
        blocks: [{ type: 'heading', size: 2, text: 'Access denied' }, { type: 'paragraph', text: 'Administrator access is required.' }],
      });
      try {
        return await sendRich(chatId, await adminStatsMessage());
      } catch (statsError) {
        return await sendRich(chatId, { blocks: [
          { type: 'heading', size: 2, text: 'Statistics database setup required' },
          { type: 'paragraph', text: 'The user registry migration has not been applied yet. Review and apply the additive bot_users table migration before using global statistics.' },
        ] });
      }
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
