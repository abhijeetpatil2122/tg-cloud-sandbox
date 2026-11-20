import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { OWNER_IDS, FEATURES } from '../lib/config.js';
import { addAdmin, isAdmin } from '../lib/admins.js';
import { fullName, helpMessage, homeMessage, sendRich, sectionMessage, customerServicesMessage } from '../lib/ui.js';
import { adminSessions, userSessions, paymentSupportTickets } from '../schema.js';
import { transactionHistoryMessage, walletMessage } from '../lib/wallet.js';
import { listTelegramServices, setTelegramServicePrice } from '../lib/provider.js';
import { createStarsInvoice, depositMessage, depositUnavailableMessage, handleSuccessfulPayment, adminRefundsMessage, refundPreviewMessage } from '../lib/payments.js';
import { listAdmins } from '../lib/admins.js';

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
    if (message.successful_payment) {
      await handleSuccessfulPayment(message);
      return;
    }

    if (message.chat.type === 'private' && text && !text.startsWith('/')) {
      const userSession = await db.select().from(userSessions)
        .where(eq(userSessions.userId, userId)).get();
      if (userSession?.action === 'payment_support') {
        const ticket = await db.insert(paymentSupportTickets).values({
          userId,
          message: text.slice(0, 3000),
          status: 'open',
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning().run();
        await db.delete(userSessions).where(eq(userSessions.userId, userId)).run();
        const ticketId = ticket?.[0]?.id;
        try {
          const admins = await listAdmins();
          await Promise.all(admins.map(id => api.sendMessage({
            chat_id: id,
            text: '💬 New payment support request\\nTicket: #' + ticketId + '\\nUser: ' + userId + '\\nMessage: ' + text.slice(0, 1800),
          }).catch(error => console.error('Payment support notification failed:', error?.description || error)));
        } catch (error) {
          console.error('Could not notify payment support admins:', error?.description || error);
        }
        await sendRich(chatId, {
          blocks: [
            { type: 'heading', size: 1, text: '💬 Request received' },
            { type: 'paragraph', text: 'Your payment support request has been sent to the team. Reference: #' + ticketId + '. Please keep this number for follow-up.' },
            { type: 'buttons', buttons: [{ text: '‹ Main menu', callback_data: 'ps:home', style: 'link' }] },
          ],
        });
        return;
      }
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

    if (parsed.command === '/deposit') {
      if (!parsed.argument) {
        return await sendRich(chatId, FEATURES.depositsEnabled ? depositMessage() : depositUnavailableMessage());
      }
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

    if (parsed.command === '/paysupport') {
      await db.insert(userSessions).values({ userId, action: 'payment_support', createdAt: new Date() })
        .onConflictDoUpdate({ target: userSessions.userId, set: { action: 'payment_support', createdAt: new Date() } }).run();
      return await sendRich(chatId, {
        blocks: [
          { type: 'heading', size: 1, text: '💬 Payment support' },
          { type: 'paragraph', text: 'Describe the payment problem in your next message. Include the transaction reference or approximate payment time if available. Never send passwords or login codes.' },
          { type: 'buttons', buttons: [{ text: 'Cancel', callback_data: 'ps:support:cancel', style: 'link' }] },
        ],
      });
    }

    if (parsed.command === '/terms') {
      return await sendRich(chatId, {
        blocks: [
          { type: 'heading', size: 1, text: '📜 Store terms' },
          { type: 'paragraph', text: 'Payments: deposits are accepted only in Telegram Stars (XTR). Portal Points are credited only after Telegram confirms a successful payment. A payment attempt, screenshot or pre-checkout approval is not proof of payment.' },
          { type: 'paragraph', text: 'Store credit: 1 paid Star adds 1 Portal Point. Portal Points are internal, non-cash store credit. They cannot be withdrawn, transferred for cash or redeemed as Stars.' },
          { type: 'paragraph', text: 'Services: each service has its own requirements, quantity limits, delivery estimates and refill/cancellation conditions. Results and delivery times are not guaranteed beyond the selected service description.' },
          { type: 'paragraph', text: 'Orders: provide a valid public Telegram target and check the service details before confirming. Do not submit private credentials, passwords or login codes.' },
          { type: 'paragraph', text: 'Refunds and payment issues: contact /paysupport with your transaction reference. Refund requests are reviewed against the payment record and wallet activity.' },
          { type: 'paragraph', text: 'Abuse: self-referrals, fake activity, fraudulent payments and attempts to exploit the service may result in suspended access and reversal of promotional rewards.' },
          { type: 'buttons', buttons: [{ text: '💬 Payment support', callback_data: 'ps:support:payment' }, { text: '‹ Main menu', callback_data: 'ps:home', style: 'link' }] },
        ],
      });
    }

    if (parsed.command === '/services') {
      try {
        return await sendRich(chatId, customerServicesMessage(await listTelegramServices(true)));
      } catch {
        return await sendRich(chatId, customerServicesMessage([]));
      }
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

    if (parsed.command === '/refund') {
      if (!await isAdmin(userId)) {
        return await sendRich(chatId, {
          blocks: [
            { type: 'heading', size: 1, text: 'Access denied' },
            { type: 'paragraph', text: 'Only administrators can review Stars refunds.' },
          ],
        });
      }
      if (parsed.argument && /^\\d{1,12}$/.test(parsed.argument)) {
        return await sendRich(chatId, await refundPreviewMessage(Number(parsed.argument)));
      }
      return await sendRich(chatId, await adminRefundsMessage(0));
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
