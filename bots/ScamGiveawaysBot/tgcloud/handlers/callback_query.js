import { api, db } from 'sdk';
import { and, eq } from 'sdk/db';
import { reportDrafts, scamReports, adminSessions } from '../schema.js';
import {
  getDraft, saveDraft, deleteDraft, getSetting,
  saveAdminSession, deleteAdminSession,
} from '../lib/sessions.js';
import {
  welcomeMessage, promptMessage, previewMessage, previewKeyboard, editKeyboard,
  reportPostMessage, adminPanelMessage, adminPanelKeyboard, resetConfirmMessage,
  adminReviewKeyboard,
} from '../lib/formatting.js';

const ADMIN_IDS = [6522801911, 1314643983];
function isAdmin(id) { return ADMIN_IDS.includes(Number(id)); }
async function answer(id, text, alert = false) {
  await api.answerCallbackQuery({ callback_query_id: id, ...(text ? { text, show_alert: alert } : {}) });
}
async function edit(chatId, messageId, rich, keyboard) {
  return api.editMessageText({ chat_id: chatId, message_id: messageId, rich_message: rich, reply_markup: keyboard || { inline_keyboard: [] } });
}
function homeKeyboard() {
  return { inline_keyboard: [[{ text: 'Report', callback_data: 'sg:start', style: 'success' }]] };
}
async function showAdminPanel(chatId, messageId) {
  const title = await getSetting('publish_channel_title');
  return edit(chatId, messageId, adminPanelMessage(title), adminPanelKeyboard());
}
async function notifyReporter(report, text) {
  try {
    await api.sendRichMessage({ chat_id: report.reporterId, rich_message: { blocks: [
      { type: 'heading', size: 2, text: text.heading },
      { type: 'paragraph', text: text.body },
    ] } });
  } catch (error) {
    console.warn('Could not notify report author', error?.description || error?.message || error);
  }
}
async function adminAction(query, parts) {
  const chat = query.message.chat;
  const user = query.from;
  const action = parts[2];
  if (action === 'home') {
    await answer(query.id);
    await deleteAdminSession(user.id);
    return showAdminPanel(chat.id, query.message.message_id);
  }
  if (action === 'configure') {
    await answer(query.id);
    await saveAdminSession({
      userId: user.id, chatId: chat.id, promptMessageId: query.message.message_id,
      step: 'channel', updatedAt: new Date(),
    });
    return edit(chat.id, query.message.message_id, { blocks: [
      { type: 'heading', size: 2, text: '📢 Configure publishing channel' },
      { type: 'paragraph', text: 'Send the public channel username (for example @channelname) or its numeric channel ID beginning with -100.' },
      { type: 'paragraph', text: 'The bot must be an administrator with permission to post messages.' },
    ] }, { inline_keyboard: [[{ text: 'Cancel', callback_data: 'sg:admin:home' }]] });
  }
  if (action === 'reset') {
    await answer(query.id);
    return edit(chat.id, query.message.message_id, resetConfirmMessage(), {
      inline_keyboard: [[{ text: 'Confirm reset', callback_data: 'sg:admin:reset_confirm', style: 'danger' }, { text: 'Cancel', callback_data: 'sg:admin:home' }]],
    });
  }
  if (action === 'reset_cancel') {
    await answer(query.id, 'Reset cancelled.');
    return showAdminPanel(chat.id, query.message.message_id);
  }
  if (action === 'reset_confirm') {
    await answer(query.id, 'Clearing report data…');
    await db.delete(reportDrafts).run();
    await db.delete(scamReports).run();
    await db.delete(adminSessions).run();
    return edit(chat.id, query.message.message_id, { blocks: [
      { type: 'heading', size: 2, text: '✓ Test data cleared' },
      { type: 'paragraph', text: 'All report drafts and stored reports have been deleted. The publishing channel configuration was preserved.' },
    ] }, { inline_keyboard: [[{ text: 'Back to admin panel', callback_data: 'sg:admin:home' }]] });
  }
  if (action === 'approve' || action === 'decline') {
    const reportId = Number(parts[3]);
    if (!Number.isSafeInteger(reportId) || reportId < 1) return answer(query.id, 'Invalid report ID.', true);
    const report = await db.select().from(scamReports).where(eq(scamReports.id, reportId)).get();
    if (!report) return answer(query.id, 'This report no longer exists.', true);
    if (report.status !== 'pending_review') return answer(query.id, 'This report has already been reviewed.', true);
    if (action === 'decline') {
      const changed = await db.update(scamReports).set({
        status: 'declined', reviewedBy: user.id, reviewedAt: new Date(),
      }).where(and(eq(scamReports.id, reportId), eq(scamReports.status, 'pending_review'))).run();
      if (!changed.rowsAffected) return answer(query.id, 'This report has already been reviewed.', true);
      await answer(query.id, 'Report declined.');
      await notifyReporter(report, {
        heading: 'Report not approved',
        body: `Your report #${reportId} was reviewed by an administrator and was not approved for publication.`,
      });
      return edit(chat.id, query.message.message_id, { blocks: [
        { type: 'heading', size: 2, text: '⛔ Report declined' },
        { type: 'paragraph', text: `Report #${reportId} was declined by an administrator.` },
      ] });
    }

    const channelId = await getSetting('publish_channel_id');
    if (!channelId) return answer(query.id, 'Configure a publishing channel in /admin before approving reports.', true);
    const claimed = await db.update(scamReports).set({
      status: 'publishing', reviewedBy: user.id, reviewedAt: new Date(),
    }).where(and(eq(scamReports.id, reportId), eq(scamReports.status, 'pending_review'))).run();
    if (!claimed.rowsAffected) return answer(query.id, 'This report has already been reviewed.', true);
    await answer(query.id, 'Publishing approved report…');
    try {
      const posted = await api.sendRichMessage({
        chat_id: channelId,
        rich_message: reportPostMessage(report, reportId, false),
      });
      await db.update(scamReports).set({
        status: 'published',
        publishedChatId: String(channelId),
        publishedMessageId: posted.message_id,
      }).where(eq(scamReports.id, reportId)).run();
      await notifyReporter(report, {
        heading: '✓ Report approved',
        body: `Your report #${reportId} was approved and published to the configured reporting channel.`,
      });
      return edit(chat.id, query.message.message_id, { blocks: [
        { type: 'heading', size: 2, text: '✓ Report approved and published' },
        { type: 'paragraph', text: `Report #${reportId} is now published in the configured channel.` },
      ] });
    } catch (error) {
      await db.update(scamReports).set({ status: 'pending_review', reviewedBy: null, reviewedAt: null })
        .where(eq(scamReports.id, reportId)).run();
      console.error('Could not publish approved report', error?.description || error?.message || error);
      return edit(chat.id, query.message.message_id, { blocks: [
        { type: 'heading', size: 2, text: '⚠️ Publishing failed' },
        { type: 'paragraph', text: 'The report could not be published. It has been returned to the pending queue so an administrator can retry after checking the channel permissions.' },
      ] }, adminReviewKeyboard(reportId));
    }
  }
  return answer(query.id, 'This admin action is not available.');
}
export default async function (query) {
  if (!query?.id) return;
  const chat = query.message?.chat;
  const user = query.from;
  const parts = String(query.data || '').split(':');
  if (!chat?.id || chat.type !== 'private' || !user?.id || chat.id !== user.id) return answer(query.id, 'Please use this bot in your private chat.');
  if (parts[0] !== 'sg') return answer(query.id, 'This button is not available.');
  if (parts[1] === 'admin') {
    if (!isAdmin(user.id)) return answer(query.id, 'Administrator access required.', true);
    try { return await adminAction(query, parts); }
    catch (error) {
      console.error('ScamGiveawaysBot admin action failed', error?.description || error?.message || error);
      try { return await answer(query.id, 'Something went wrong. Please try again.', true); } catch {}
    }
    return;
  }

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
        inline_keyboard: [[{ text: 'Cancel', callback_data: 'sg:cancel' }]],
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
        { type: 'heading', size: 2, text: '🛑 Report cancelled' },
        { type: 'paragraph', text: 'Your report has been cancelled. Nothing was submitted.' },
      ] }, { inline_keyboard: [[{ text: '‹ Back to menu', callback_data: 'sg:home' }]] });
    }
    if (action === 'edit') {
      await answer(query.id);
      return edit(chat.id, query.message.message_id, {
        blocks: [{ type: 'heading', size: 2, text: '✏️ Edit report' }, { type: 'paragraph', text: 'Choose the detail you want to correct.' }],
      }, editKeyboard());
    }
    if (action === 'field') {
      const field = parts[2];
      if (!['handle', 'amount', 'summary', 'proof'].includes(field)) return answer(query.id, 'Unknown report field.');
      await answer(query.id);
      await db.update(reportDrafts).set({ step: 'edit_' + field, updatedAt: new Date() }).where(eq(reportDrafts.userId, user.id)).run();
      return edit(chat.id, query.message.message_id, promptMessage('edit_' + field), {
        inline_keyboard: [[{ text: 'Cancel', callback_data: 'sg:cancel' }]],
      });
    }
    if (action === 'preview') {
      await answer(query.id);
      return edit(chat.id, query.message.message_id, previewMessage(draft), previewKeyboard());
    }
    if (action === 'submit') {
      const claim = await db.update(reportDrafts).set({ step: 'submitting', updatedAt: new Date() })
        .where(and(eq(reportDrafts.userId, user.id), eq(reportDrafts.step, 'preview'))).run();
      if (!claim.rowsAffected) return answer(query.id, 'This report is already being submitted.', true);
      try {
        const inserted = await db.insert(scamReports).values({
          reporterId: user.id,
          scammerHandle: draft.scammerHandle,
          amount: draft.amount,
          summary: draft.summary,
          proofChannel: draft.proofChannel,
          status: 'pending_review',
          createdAt: new Date(),
        }).returning({ id: scamReports.id });
        const reportId = inserted[0].id;
        const adminMessage = reportPostMessage(draft, reportId, true);
        for (const adminId of ADMIN_IDS) {
          try {
            await api.sendRichMessage({
              chat_id: adminId,
              rich_message: adminMessage,
              reply_markup: adminReviewKeyboard(reportId),
            });
          } catch (error) {
            console.warn('Could not deliver report to admin', adminId, error?.description || error?.message || error);
          }
        }
        await deleteDraft(user.id);
        await answer(query.id, 'Report submitted for review.');
        return edit(chat.id, query.message.message_id, { blocks: [
          { type: 'heading', size: 2, text: '✓ Report received' },
          { type: 'paragraph', text: `Your report #${reportId} has been sent to the administrators for review.` },
          { type: 'paragraph', text: 'You will receive a private notification when it is approved or declined. It will not be published before approval.' },
        ] }, { inline_keyboard: [[{ text: '‹ Back to menu', callback_data: 'sg:home' }]] });
      } catch (error) {
        await db.update(reportDrafts).set({ step: 'preview', updatedAt: new Date() }).where(eq(reportDrafts.userId, user.id)).run();
        console.error('Report submission failed', error?.description || error?.message || error);
        await answer(query.id, 'Could not submit the report. Please try again.', true);
        return edit(chat.id, query.message.message_id, previewMessage(draft), previewKeyboard());
      }
    }
    return answer(query.id, 'This action is not available.');
  } catch (error) {
    console.error('ScamGiveawaysBot callback failed', error?.description || error?.message || error);
    try { await answer(query.id, 'Something went wrong. Please try again.'); } catch {}
  }
}
