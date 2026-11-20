import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { OWNER_IDS } from '../lib/config.js';
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
} from '../lib/ui.js';
import { adminSessions } from '../schema.js';

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

async function showAdmin(chatId, messageId) {
  const result = await getAdminIds();
  return render(chatId, messageId, adminPanelMessage(result.ids, result.available));
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

    const sections = {
      'ps:services': 'services',
      'ps:deposit': 'deposit',
      'ps:wallet': 'wallet',
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

      if (data !== 'ps:admin' && !isOwner(userId)) {
        return answer(query.id, 'Only designated owners can manage administrators.');
      }

      if (data === 'ps:admin' || data === 'ps:admin:home') {
        return showAdmin(chatId, messageId);
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
        return showAdmin(chatId, messageId);
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
          await answer(query.id, 'That account cannot be removed.');
        }
        return showAdmin(chatId, messageId);
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
