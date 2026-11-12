import { api, db } from 'sdk';
import { and, eq } from 'sdk/db';
import { reportDrafts, scamReports } from '../schema.js';
import { getDraft, saveDraft, deleteDraft } from '../lib/sessions.js';
import { welcomeMessage, promptMessage, previewMessage, previewKeyboard, editKeyboard, reportPostMessage } from '../lib/formatting.js';

async function answer(id, text) {
  await api.answerCallbackQuery({ callback_query_id: id, ...(text ? { text } : {}) });
}
async function edit(chatId, messageId, rich, keyboard) {
  return api.editMessageText({ chat_id: chatId, message_id: messageId, rich_message: rich, reply_markup: keyboard || { inline_keyboard: [] } });
}
function homeKeyboard() {
  return { inline_keyboard: [[{ text: 'Report', callback_data: 'sg:start', style: 'success' }]] };
}
export default async function (query) {
  if (!query?.id) return;
  const chat = query.message?.chat;
  const user = query.from;
  const parts = String(query.data || '').split(':');
  if (!chat?.id || chat.type !== 'private' || !user?.id || chat.id !== user.id) return answer(query.id, 'Please use this bot in your private chat.');
  if (parts[0] !== 'sg') return answer(query.id, 'This button is not available.');
  const action = parts[1];

  try {
    if (action === 'home') {
      await answer(query.id);
      await deleteDraft(user.id);
      return edit(chat.id, query.message.message_id, welcomeMessage(user), homeKeyboard());
    }
    if (action === 'start') {
      await answer(query.id);
      await deleteDraft(user.id);
      await saveDraft({
        userId: user.id, chatId: chat.id, promptMessageId: query.message.message_id,
        step: 'handle', scammerHandle: null, amount: null, summary: null, proofChannel: null,
        createdAt: new Date(), updatedAt: new Date(),
      });
      return edit(chat.id, query.message.message_id, promptMessage('handle'), {
        inline_keyboard: [[{ text: 'Cancel ❌', callback_data: 'sg:cancel', style: 'danger' }]],
      });
    }

    const draft = await getDraft(user.id);
    if (!draft || draft.chatId !== chat.id || draft.promptMessageId !== query.message.message_id) {
      await answer(query.id, 'This report session has expired. Start a new report.');
      return edit(chat.id, query.message.message_id, welcomeMessage(user), homeKeyboard());
    }
    if (action === 'cancel') {
      await answer(query.id, 'Report cancelled.');
      await deleteDraft(user.id);
      return edit(chat.id, query.message.message_id, { blocks: [
        { type: 'heading', size: 2, text: 'Report cancelled' },
        { type: 'paragraph', text: 'Your report has been cancelled. No report was submitted.' },
      ] }, { inline_keyboard: [[{ text: '‹ Back to menu', callback_data: 'sg:home' }]] });
    }
    if (action === 'edit') {
      await answer(query.id);
      return edit(chat.id, query.message.message_id, {
        blocks: [{ type: 'heading', size: 2, text: 'Edit report' }, { type: 'paragraph', text: 'Choose the detail you want to correct.' }],
      }, editKeyboard());
    }
    if (action === 'field') {
      const field = parts[2];
      if (!['handle', 'amount', 'summary', 'proof'].includes(field)) return answer(query.id, 'Unknown report field.');
      await answer(query.id);
      await db.update(reportDrafts).set({ step: 'edit_' + field, updatedAt: new Date() }).where(eq(reportDrafts.userId, user.id)).run();
      return edit(chat.id, query.message.message_id, promptMessage('edit_' + field), {
        inline_keyboard: [[{ text: 'Cancel ❌', callback_data: 'sg:cancel', style: 'danger' }]],
      });
    }
    if (action === 'preview') {
      await answer(query.id);
      return edit(chat.id, query.message.message_id, previewMessage(draft), previewKeyboard());
    }
    if (action === 'publish') {
      const claim = await db.update(reportDrafts).set({ step: 'publishing', updatedAt: new Date() })
        .where(and(eq(reportDrafts.userId, user.id), eq(reportDrafts.step, 'preview'))).run();
      if (!claim.rowsAffected) return answer(query.id, 'This report is already being submitted.');
      try {
        await answer(query.id, 'Sending your report privately…');
        await api.sendRichMessage({ chat_id: chat.id, rich_message: reportPostMessage(draft) });
        await db.insert(scamReports).values({
          reporterId: user.id,
          scammerHandle: draft.scammerHandle,
          amount: draft.amount,
          summary: draft.summary,
          proofChannel: draft.proofChannel,
          status: 'private_test',
          createdAt: new Date(),
        }).run();
        await deleteDraft(user.id);
        return edit(chat.id, query.message.message_id, { blocks: [
          { type: 'heading', size: 2, text: '✓ Report submitted' },
          { type: 'paragraph', text: 'Your report preview has been sent in this private chat. Public channel publishing is not connected yet.' },
          { type: 'paragraph', text: 'This is stored as an unverified test submission.' },
        ] }, { inline_keyboard: [[{ text: '‹ Back to menu', callback_data: 'sg:home' }]] });
      } catch (error) {
        await db.update(reportDrafts).set({ step: 'preview', updatedAt: new Date() }).where(eq(reportDrafts.userId, user.id)).run();
        console.error('Private report submission failed', error?.description || error?.message || error);
        return edit(chat.id, query.message.message_id, previewMessage(draft), previewKeyboard());
      }
    }
    return answer(query.id, 'This action is not available.');
  } catch (error) {
    console.error('ScamGiveawaysBot callback failed', error?.description || error?.message || error);
    try { await answer(query.id, 'Something went wrong. Please try again.'); } catch {}
  }
}
