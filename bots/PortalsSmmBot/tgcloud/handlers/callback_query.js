import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { OWNER_IDS, FEATURES } from '../lib/config.js';
import { addAdmin, isAdmin, isOwner, listAdmins, removeAdmin } from '../lib/admins.js';
import {
  adminAddPromptMessage,
  adminPanelMessage,
  serviceSetupGuideMessage,
  adminRemovalMessage,
  editRich,
  sendRich,
  helpMessage,
  homeMessage,
  sectionMessage,
  unavailableMessage,
  providerAdminMessage,
  providerBalanceMessage,
  adminServicesMessage,
  customerServicesMessage,
  customerServiceDetailsMessage,
  vpnPlansMessage,
} from '../lib/ui.js';
import { adminSessions, userSessions } from '../schema.js';
import { adminTransactionsMessage, transactionHistoryMessage, walletMessage } from '../lib/wallet.js';
import { checkProviderBalance, listTelegramServices, setTelegramServiceEnabled, syncTelegramServices } from '../lib/provider.js';
import { createStarsInvoice, depositMessage, depositUnavailableMessage, adminRefundsMessage, refundPreviewMessage, refundStarsDeposit, adminPaymentsMessage } from '../lib/payments.js';
import { myOrdersMessage, orderDetailsMessage } from '../lib/orders.js';
import { resetPreviewMessage, resetTestData, resetCompleteMessage } from '../lib/reset.js';
import { trackUser, isUserBanned, adminStatsMessage } from '../lib/users.js';

async function answer(id, text = '') {
  const params = { callback_query_id: id };
  if (text) params.text = text;
  await api.answerCallbackQuery(params);
}

async function render(chatId, messageId, richMessage) {
  try {
    if (messageId && typeof messageId === 'object' && messageId.inline_message_id) {
      return await api.editMessageText({
        inline_message_id: messageId.inline_message_id,
        rich_message: richMessage,
      });
    }
    if (messageId) return await editRich(chatId, messageId, richMessage);
  } catch (editError) {
    console.error('PortalsSmmBot rich screen edit failed; sending a new message:', editError?.description || editError?.message || editError);
  }
  return sendRich(chatId, richMessage);
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
  const inlineMessageId = query.inline_message_id;
  const userId = Number(query.from.id);

  // Bot API 10.5 can deliver callbacks with inline_message_id instead of
  // message, depending on callback_query_mode. Do not discard those updates.
  if (!message && !inlineMessageId) {
    await answer(query.id, 'This button is no longer available.');
    return;
  }
  if (message && (
    !message.chat?.id ||
    message.chat.type !== 'private' ||
    Number(message.chat.id) !== userId
  )) {
    await answer(query.id, 'Open the bot in a private chat.');
    return;
  }

  const data = String(query.data || '');
  const chatId = message?.chat?.id || userId;
  const messageId = message?.message_id || (inlineMessageId ? { inline_message_id: inlineMessageId } : null);

  try {
    // A callback must be acknowledged, but a transient acknowledgement error
    // must never prevent the requested screen from being rendered.
    try {
      await answer(query.id);
    } catch (ackError) {
      console.error('PortalsSmmBot callback acknowledgement failed:', ackError?.description || ackError?.message || ackError);
    }

    // Public storefront navigation must not depend on database availability.
    // In particular, a slow user-registry lookup must not stall Deposit,
    // Support, or VPN navigation after the user taps a Rich Message button.
    if (data === 'ps:home') {
      return render(chatId, messageId, homeMessage(
        [query.from.first_name, query.from.last_name].filter(Boolean).join(' ') || 'there',
        OWNER_IDS.includes(userId),
      ));
    }
    if (data === 'ps:help') return render(chatId, messageId, helpMessage(false));
    if (data === 'ps:deposit') {
      const screen = FEATURES.depositsEnabled ? depositMessage() : depositUnavailableMessage();
      return await render(chatId, messageId, screen);
    }
    if (data === 'ps:support') {
      return await render(chatId, messageId, sectionMessage('support'));
    }
    if (data === 'ps:vpn') {
      return await render(chatId, messageId, vpnPlansMessage());
    }

    // Only database-backed actions need user tracking and ban enforcement.
    await trackUser(query.from, message?.chat?.type || 'private');
    if (await isUserBanned(userId) && !await isAdmin(userId)) {
      return render(chatId, messageId, {
        blocks: [
          { type: 'heading', size: 2, text: 'Access restricted' },
          { type: 'paragraph', text: 'This account is currently restricted from using the storefront. Contact support if you believe this is a mistake.' },
        ],
      });
    }
    if (data === 'ps:deposit:custom') {
      await db.insert(userSessions).values({ userId, action: 'custom_deposit', createdAt: new Date() })
        .onConflictDoUpdate({ target: userSessions.userId, set: { action: 'custom_deposit', createdAt: new Date() } }).run();
      return render(chatId, messageId, { blocks: [
        { type: 'heading', size: 2, text: 'Custom Stars deposit' },
        { type: 'paragraph', text: 'Send the number of Stars you want to deposit. Minimum 1 Star; maximum 100,000 Stars. Example: 25' },
        { type: 'buttons', buttons: [{ text: 'Cancel', callback_data: 'ps:deposit:cancel', style: 'link' }] },
      ] });
    }
    if (data === 'ps:deposit:cancel') {
      await db.delete(userSessions).where(eq(userSessions.userId, userId)).run();
      return render(chatId, messageId, depositMessage());
    }
    const depositChoice = data.match(/^ps:deposit:(\d{1,5})$/);
    if (depositChoice) {
      try {
        await createStarsInvoice(userId, chatId, Number(depositChoice[1]));
        return render(chatId, messageId, {
          blocks: [
            { type: 'heading', size: 1, text: '⭐ Invoice created' },
            { type: 'paragraph', text: 'Complete the Telegram Stars payment in the invoice message. Your USD wallet balance will be credited after Telegram confirms payment.' },
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
    if (data === 'ps:wallet') return render(chatId, messageId, await walletMessage(userId));
    if (data === 'ps:history') return render(chatId, messageId, await transactionHistoryMessage(userId, 0));
    if (data === 'ps:orders') return render(chatId, messageId, await myOrdersMessage(userId, 0));
    const ordersPage = data.match(/^ps:orders:(\d{1,4})$/);
    if (ordersPage) return render(chatId, messageId, await myOrdersMessage(userId, Number(ordersPage[1])));
    const orderDetail = data.match(/^ps:order:(\d{1,12})$/);
    if (orderDetail) return render(chatId, messageId, await orderDetailsMessage(userId, Number(orderDetail[1])));
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
      if (data === 'ps:admin:stats') {
        try { return render(chatId, messageId, await adminStatsMessage()); }
        catch {
          return render(chatId, messageId, {
            blocks: [
              { type: 'heading', size: 2, text: 'Statistics database setup required' },
              { type: 'paragraph', text: 'Apply the reviewed additive bot_users migration to activate user tracking and global statistics.' },
              { type: 'buttons', buttons: [{ text: '‹ Administrator panel', callback_data: 'ps:admin', style: 'link' }] },
            ],
          });
        }
      }

      const adminInputActions = {
        'ps:admin:balance:add': 'balance_add',
        'ps:admin:balance:remove': 'balance_remove',
        'ps:admin:user:ban': 'user_ban',
        'ps:admin:user:unban': 'user_unban',
      };
      if (adminInputActions[data]) {
        const action = adminInputActions[data];
        await db.insert(adminSessions).values({ userId, action, createdAt: new Date() })
          .onConflictDoUpdate({ target: adminSessions.userId, set: { action, createdAt: new Date() } }).run();
        const prompts = {
          balance_add: ['Add USD balance', 'Send: USER_ID AMOUNT_USD followed by an optional reason. Example: 123456789 50 goodwill'],
          balance_remove: ['Remove USD balance', 'Send: USER_ID AMOUNT_USD followed by an optional reason. The debit is blocked if the wallet balance is insufficient.'],
          user_ban: ['Ban customer', 'Send the numeric Telegram user ID to restrict. Administrator accounts are protected.'],
          user_unban: ['Unban customer', 'Send the numeric Telegram user ID to restore access.'],
        };
        return render(chatId, messageId, {
          blocks: [
            { type: 'heading', size: 2, text: prompts[action][0] },
            { type: 'paragraph', text: prompts[action][1] },
            { type: 'buttons', buttons: [{ text: 'Cancel', callback_data: 'ps:admin:cancel', style: 'link' }] },
          ],
        });
      }
      if (data === 'ps:admin:service-guide') return render(chatId, messageId, serviceSetupGuideMessage());

      if (data === 'ps:admin:provider:check') {
        try {
          const balance = await checkProviderBalance();
          const services = await listTelegramServices(false);
          return render(chatId, messageId, providerBalanceMessage({ ...balance, services }));
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
          const syncSummary = result.telegramImported
            ? `Synced ${result.telegramImported} Telegram services from ${result.providerTotal} supplier listings.`
            : `No Telegram services matched among ${result.providerTotal} supplier listings. Categories seen: ${(result.categoriesSeen || []).join(', ') || 'not supplied'}. Sample service names: ${(result.serviceExamples || []).join(' · ') || 'not supplied'}.`;
          page.blocks.splice(2, 0, { type: 'paragraph', text: syncSummary });
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
            { type: 'paragraph', text: 'Send the selling price in whole USD. The service will remain disabled until you enable it.' },
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
              { type: 'paragraph', text: result.duplicate ? 'This deposit has already been refunded.' : 'Telegram confirmed the Stars refund and the USD wallet balance reversal was recorded.' },
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

      if (data === 'ps:admin:payments') {
        return render(chatId, messageId, await adminPaymentsMessage('confirmed', 0));
      }
      const paymentsPage = data.match(/^ps:admin:payments:(confirmed|review|refunded|failed):(\d{1,4})$/);
      if (paymentsPage) {
        return render(chatId, messageId, await adminPaymentsMessage(paymentsPage[1], Number(paymentsPage[2])));
      }

      if (data === 'ps:admin:resetdb') {
        return render(chatId, messageId, await resetPreviewMessage());
      }
      if (data === 'ps:admin:resetdb:confirm') {
        const result = await resetTestData();
        return render(chatId, messageId, resetCompleteMessage(result));
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
