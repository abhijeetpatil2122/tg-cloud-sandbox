import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { OWNER_IDS, FEATURES } from '../lib/config.js';
import { addAdmin, isAdmin, isOwner, listAdmins, removeAdmin } from '../lib/admins.js';
import {
  adminAddPromptMessage,
  adminPanelMessage,
  adminRemovalMessage,
  editRich,
  helpMessage,
  homeMessage,
  sectionMessage,
  unavailableMessage,
  providerAdminMessage,
  providerBalanceMessage,
  adminServicesMessage,
  customerServicesMessage,
  customerServiceDetailsMessage,
} from '../lib/ui.js';
import { adminSessions, userSessions } from '../schema.js';
import { adminTransactionsMessage, transactionHistoryMessage, walletMessage } from '../lib/wallet.js';
import { checkProviderBalance, listTelegramServices, setTelegramServiceEnabled, syncTelegramServices } from '../lib/provider.js';
import { createStarsInvoice, depositMessage, depositUnavailableMessage, adminRefundsMessage, refundPreviewMessage, refundStarsDeposit } from '../lib/payments.js';

async function answer(id, text = '') {
  const params = { callback_query_id: id };
  if (text) params.text = text;
  await api.answerCallbackQuery(params);
}

async function render(chatId, messageId, richMessage) {
  return editRich(chatId, messageId, richMessage);
}

async function getAdminIds() {
  try {
    return { ids: await listAdmins(), available: true };
  } catch (error) {
    console.error('PortalsSmmBot admin list failed:', error?.description || error);
    return { ids: [...new Set(OWNER_IDS)].sort((a, b) => a - b), available: false };
  }
}

async function showAdmin(chatId, messageId, userId) {
  const result = await getAdminIds();
  return render(chatId, messageId, adminPanelMessage(result.ids, result.available, isOwner(userId)));
}

export default async function handleCallbackQuery(query) {
  if (!query?.id || !query?.from?.id) return;
  const message = query.message;
  if (!message?.chat?.id || message.chat.type !== 'private' || message.chat.id !== query.from.id) {
    await answer(query.id, 'Open the bot in a private chat.');
    return;
  }

  const userId = Number(query.from.id);
  const data = String(query.data || '');
  const chatId = message.chat.id;
  const messageId = message.message_id;

  try {
    // Acknowledge promptly; subsequent screen edits happen on the same message.
    await answer(query.id);

    if (data === 'ps:home') {
      return render(chatId, messageId, homeMessage(
        [query.from.first_name, query.from.last_name].filter(Boolean).join(' ') || 'there',
        OWNER_IDS.includes(userId),
      ));
    }

    if (data === 'ps:help') return render(chatId, messageId, helpMessage());

    if (data === 'ps:deposit') {
      return render(chatId, messageId, FEATURES.depositsEnabled ? depositMessage() : depositUnavailableMessage());
    }
    const depositChoice = data.match(/^ps:deposit:(\d{1,5})$/);
    if (depositChoice) {
      try {
        await createStarsInvoice(userId, chatId, Number(depositChoice[1]));
        return render(chatId, messageId, {
          blocks: [
            { type: 'heading', size: 1, text: '⭐ Invoice created' },
            { type: 'paragraph', text: 'Complete the Telegram Stars payment in the invoice message. Your Portal Points will be credited after Telegram confirms payment.' },
            { type: 'buttons', buttons: [{ text: '‹ Deposit options', callback_data: 'ps:deposit', style: 'link' }] },
          ],
        });
      } catch (error) {
        return render(chatId, messageId, {
          blocks: [
            { type: 'heading', size: 1, text: '⭐ Deposit unavailable' },
            { type: 'paragraph', text: error?.message || 'The invoice could not be created. Please try again later.' },
            { type: 'buttons', buttons: [{ text: '‹ Deposit options', callback_data: 'ps:deposit', style: 'link' }] },
          ],
        });
      }
    }
    if (data === 'ps:support:cancel') {
      await db.delete(userSessions).where(eq(userSessions.userId, userId)).run();
      return render(chatId, messageId, sectionMessage('support'));
    }
    if (data === 'ps:support:payment') {
      await db.insert(userSessions).values({ userId, action: 'payment_support', createdAt: new Date() })
        .onConflictDoUpdate({ target: userSessions.userId, set: { action: 'payment_support', createdAt: new Date() } }).run();
      return render(chatId, messageId, {
        blocks: [
          { type: 'heading', size: 1, text: '💬 Payment support' },
          { type: 'paragraph', text: 'Describe the payment problem in your next message. Include a transaction reference or approximate payment time if available. Never send passwords or login codes.' },
          { type: 'buttons', buttons: [{ text: 'Cancel', callback_data: 'ps:support:cancel', style: 'link' }] },
        ],
      });
    }
    if (data === 'ps:wallet') return render(chatId, messageId, await walletMessage(userId));
    if (data === 'ps:history') return render(chatId, messageId, await transactionHistoryMessage(userId, 0));
    const historyPage = data.match(/^ps:history:(\d{1,4})$/);
    if (historyPage) return render(chatId, messageId, await transactionHistoryMessage(userId, Number(historyPage[1])));

    if (data === 'ps:services') {
      try {
        return render(chatId, messageId, customerServicesMessage(await listTelegramServices(true)));
      } catch {
        return render(chatId, messageId, customerServicesMessage([]));
      }
    }
    const customerServicePage = data.match(/^ps:services:(\d{1,4})$/);
    if (customerServicePage) {
      try {
        return render(chatId, messageId, customerServicesMessage(
          await listTelegramServices(true),
          Number(customerServicePage[1]),
        ));
      } catch {
        return render(chatId, messageId, customerServicesMessage([]));
      }
    }
    const serviceDetail = data.match(/^ps:service:(\d{1,12})$/);
    if (serviceDetail) {
      try {
        const services = await listTelegramServices(true);
        const item = services.find(service => service.serviceId === Number(serviceDetail[1]));
        return render(chatId, messageId, item ? customerServiceDetailsMessage(item) : unavailableMessage());
      } catch {
        return render(chatId, messageId, customerServicesMessage([]));
      }
    }

    const sections = {
      'ps:deposit': 'deposit',
      'ps:orders': 'orders',
      'ps:referral': 'referral',
      'ps:support': 'support',
    };
    if (sections[data]) return render(chatId, messageId, sectionMessage(sections[data]));

    if (data.startsWith('ps:admin')) {
      if (!await isAdmin(userId)) {
        return render(chatId, messageId, {
          blocks: [
            { type: 'heading', size: 2, text: 'Access denied' },
            { type: 'paragraph', text: 'This account is not registered as a bot administrator.' },
            { type: 'buttons', buttons: [{ text: '‹ Main menu', callback_data: 'ps:home', style: 'link' }] },
          ],
        });
      }

      const ownerOnlyAction = ['ps:admin:add', 'ps:admin:remove'].includes(data) || data.startsWith('ps:admin:del:');
      if (ownerOnlyAction && !isOwner(userId)) {
        return render(chatId, messageId, {
          blocks: [
            { type: 'heading', size: 2, text: 'Owner permission required' },
            { type: 'paragraph', text: 'Only the designated owners can add or remove administrators.' },
            { type: 'buttons', buttons: [{ text: '‹ Administrator panel', callback_data: 'ps:admin', style: 'link' }] },
          ],
        });
      }

      if (data === 'ps:admin' || data === 'ps:admin:home') {
        return showAdmin(chatId, messageId, userId);
      }

      if (data === 'ps:admin:provider') return render(chatId, messageId, providerAdminMessage());

      if (data === 'ps:admin:provider:check') {
        try {
          const balance = await checkProviderBalance();
          return render(chatId, messageId, providerBalanceMessage(balance));
        } catch (providerError) {
          return render(chatId, messageId, {
            blocks: [
              { type: 'heading', size: 1, text: 'Provider connection' },
              { type: 'paragraph', text: 'The supplier could not be reached. Check the provider settings and try again.' },
              { type: 'buttons', buttons: [{ text: '‹ Provider', callback_data: 'ps:admin:provider', style: 'link' }] },
            ],
          });
        }
      }

      if (data === 'ps:admin:services:sync') {
        if (!FEATURES.providerSyncEnabled) {
          return render(chatId, messageId, {
            blocks: [
              { type: 'heading', size: 1, text: 'Catalogue setup' },
              { type: 'paragraph', text: 'Service syncing will be available after the catalogue database setup is complete.' },
              { type: 'buttons', buttons: [{ text: '‹ Provider', callback_data: 'ps:admin:provider', style: 'link' }] },
            ],
          });
        }
        try {
          const result = await syncTelegramServices();
          const services = await listTelegramServices(false);
          const page = adminServicesMessage(services, 0);
          page.blocks.splice(2, 0, { type: 'paragraph', text: `Synced ${result.telegramImported} Telegram services from ${result.providerTotal} supplier listings.` });
          return render(chatId, messageId, page);
        } catch (providerError) {
          return render(chatId, messageId, {
            blocks: [
              { type: 'heading', size: 1, text: 'Service sync failed' },
              { type: 'paragraph', text: 'The supplier service list could not be loaded. Check the connection and try again.' },
              { type: 'buttons', buttons: [{ text: '‹ Provider', callback_data: 'ps:admin:provider', style: 'link' }] },
            ],
          });
        }
      }

      if (data === 'ps:admin:services') {
        try {
          return render(chatId, messageId, adminServicesMessage(await listTelegramServices(false), 0));
        } catch {
          return render(chatId, messageId, adminServicesMessage([]));
        }
      }
      const servicePage = data.match(/^ps:admin:services:(\d{1,4})$/);
      if (servicePage) {
        try {
          return render(chatId, messageId, adminServicesMessage(await listTelegramServices(false), Number(servicePage[1])));
        } catch {
          return render(chatId, messageId, adminServicesMessage([]));
        }
      }

      const serviceToggle = data.match(/^ps:admin:service:(enable|disable):(\d{1,12})$/);
      if (serviceToggle) {
        try {
          await setTelegramServiceEnabled(Number(serviceToggle[2]), serviceToggle[1] === 'enable');
          return render(chatId, messageId, adminServicesMessage(await listTelegramServices(false), 0));
        } catch (serviceError) {
          return render(chatId, messageId, {
            blocks: [
              { type: 'heading', size: 2, text: 'Service not updated' },
              { type: 'paragraph', text: serviceError?.message === 'Set a customer price before enabling this service.' ? 'Set a customer price before enabling this service.' : 'The service could not be updated.' },
              { type: 'buttons', buttons: [{ text: '‹ Services', callback_data: 'ps:admin:services', style: 'link' }] },
            ],
          });
        }
      }

      const servicePrice = data.match(/^ps:admin:service:price:(\d{1,12})$/);
      if (servicePrice) {
        await db.insert(adminSessions).values({ userId, action: `set_service_price:${servicePrice[1]}`, createdAt: new Date() })
          .onConflictDoUpdate({ target: adminSessions.userId, set: { action: `set_service_price:${servicePrice[1]}`, createdAt: new Date() } }).run();
        return render(chatId, messageId, {
          blocks: [
            { type: 'heading', size: 2, text: 'Set customer price' },
            { type: 'paragraph', text: 'Send the selling price in whole Portal Points. The service will remain disabled until you enable it.' },
            { type: 'buttons', buttons: [{ text: 'Cancel', callback_data: 'ps:admin:cancel', style: 'link' }] },
          ],
        });
      }

      if (data === 'ps:admin:refunds') {
        return render(chatId, messageId, await adminRefundsMessage(0));
      }
      const refundPage = data.match(/^ps:admin:refunds:(\d{1,4})$/);
      if (refundPage) {
        return render(chatId, messageId, await adminRefundsMessage(Number(refundPage[1])));
      }
      const refundPreview = data.match(/^ps:admin:refund:(\d{1,12})$/);
      if (refundPreview) {
        return render(chatId, messageId, await refundPreviewMessage(Number(refundPreview[1])));
      }
      const refundConfirm = data.match(/^ps:admin:refund:confirm:(\d{1,12})$/);
      if (refundConfirm) {
        try {
          const result = await refundStarsDeposit(Number(refundConfirm[1]), userId);
          return render(chatId, messageId, {
            blocks: [
              { type: 'heading', size: 1, text: result.duplicate ? '↩️ Refund already completed' : '↩️ Refund completed' },
              { type: 'paragraph', text: result.duplicate ? 'This deposit has already been refunded.' : 'Telegram confirmed the Stars refund and the Portal Points reversal was recorded.' },
              { type: 'buttons', buttons: [{ text: '‹ Refunds', callback_data: 'ps:admin:refunds', style: 'link' }] },
            ],
          });
        } catch (error) {
          return render(chatId, messageId, {
            blocks: [
              { type: 'heading', size: 1, text: '⚠️ Refund not completed' },
              { type: 'paragraph', text: error?.message || 'The refund could not be completed.' },
              { type: 'buttons', buttons: [{ text: '‹ Refunds', callback_data: 'ps:admin:refunds', style: 'link' }] },
            ],
          });
        }
      }

      if (data === 'ps:admin:transactions') {
        return render(chatId, messageId, await adminTransactionsMessage(0));
      }
      const adminHistoryPage = data.match(/^ps:admin:transactions:(\d{1,4})$/);
      if (adminHistoryPage) {
        return render(chatId, messageId, await adminTransactionsMessage(Number(adminHistoryPage[1])));
      }

      if (data === 'ps:admin:add') {
        await db.insert(adminSessions)
          .values({ userId, action: 'add_admin', createdAt: new Date() })
          .onConflictDoUpdate({
            target: adminSessions.userId,
            set: { action: 'add_admin', createdAt: new Date() },
          }).run();
        return render(chatId, messageId, adminAddPromptMessage());
      }

      if (data === 'ps:admin:cancel') {
        await db.delete(adminSessions).where(eq(adminSessions.userId, userId)).run();
        return showAdmin(chatId, messageId, userId);
      }

      if (data === 'ps:admin:remove') {
        const { ids, available } = await getAdminIds();
        const removable = available ? ids.filter(id => !isOwner(id)) : [];
        return render(chatId, messageId, adminRemovalMessage(removable));
      }

      const match = data.match(/^ps:admin:del:(\d{5,15})$/);
      if (match) {
        const result = await removeAdmin(Number(match[1]));
        if (!result.removed) {
          return render(chatId, messageId, {
            blocks: [
              { type: 'heading', size: 2, text: 'Administrator not removed' },
              { type: 'paragraph', text: 'That account is protected or is not a removable administrator.' },
              { type: 'buttons', buttons: [{ text: '‹ Administrator panel', callback_data: 'ps:admin', style: 'link' }] },
            ],
          });
        }
        return showAdmin(chatId, messageId, userId);
      }
    }

    return render(chatId, messageId, unavailableMessage());
  } catch (error) {
    console.error('PortalsSmmBot callback handler failed:', error?.description || error?.stack || error);
    try {
      await render(chatId, messageId, {
        blocks: [
          { type: 'heading', size: 2, text: 'Action unavailable' },
          { type: 'paragraph', text: 'This action could not be completed. Please return to the main menu and try again.' },
          { type: 'buttons', buttons: [{ text: '‹ Main menu', callback_data: 'ps:home', style: 'link' }] },
        ],
      });
    } catch (editError) {
      console.error('PortalsSmmBot callback error screen failed:', editError?.description || editError);
    }
  }
}
