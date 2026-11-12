import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { reportDrafts, scamReports } from '../schema.js';
import {
  welcomeMessage, promptMessage, previewMessage, previewKeyboard,
  adminPanelMessage, adminPanelKeyboard,
} from '../lib/formatting.js';
import {
  deleteDraft, getDraft, getAdminSession, deleteAdminSession,
  getSetting, setSetting,
} from '../lib/sessions.js';

const ADMIN_IDS = [6522801911, 1314643983];
function isAdmin(id) { return ADMIN_IDS.includes(Number(id)); }
function commandOf(value) {
  return String(value || '').trim().split(/\s+/, 1)[0].split('@', 1)[0].toLowerCase();
}
async function deleteInput(message) {
  try { await api.deleteMessage({ chat_id: message.chat.id, message_id: message.message_id }); }
  catch (error) { console.warn('Could not delete report input', error?.description || error?.message || error); }
}
async function showHome(chatId, user) {
  await deleteDraft(user.id);
  return api.sendRichMessage({
    chat_id: chatId,
    rich_message: welcomeMessage(user),
    reply_markup: { inline_keyboard: [[{ text: 'Report', callback_data: 'sg:start', style: 'success' }]] },
  });
}
async function showAdminPanel(chatId) {
  const title = await getSetting('publish_channel_title');
  return api.sendRichMessage({ chat_id: chatId, rich_message: adminPanelMessage(title), reply_markup: adminPanelKeyboard() });
}
async function configureChannel(message, session) {
  const value = String(message.text || '').trim();
  await deleteInput(message);
  const validInput = /^@[A-Za-z0-9_]{5,32}$/.test(value) || /^-100\d{6,}$/.test(value);
  if (!validInput) {
    return api.editMessageText({
      chat_id: message.chat.id, message_id: session.promptMessageId,
      rich_message: { blocks: [
        { type: 'heading', size: 2, text: '⚠️ Invalid channel' },
        { type: 'paragraph', text: 'Send a public channel username such as @channelname or its numeric channel ID beginning with -100.' },
      ] },
      reply_markup: { inline_keyboard: [[{ text: 'Cancel', callback_data: 'sg:admin:home' }]] },
    });
  }
  try {
    const channel = await api.getChat({ chat_id: value });
    if (channel.type !== 'channel') throw new Error('The selected chat is not a channel.');
    const me = await api.getMe();
    const member = await api.getChatMember({ chat_id: channel.id, user_id: me.id });
    if (member.status !== 'creator' && !(member.status === 'administrator' && member.can_post_messages !== false)) {
      throw new Error('Make the bot an administrator in that channel and allow it to post messages.');
    }
    await setSetting('publish_channel_id', channel.id);
    await setSetting('publish_channel_title', channel.title || (channel.username ? '@' + channel.username : String(channel.id)));
    await deleteAdminSession(message.from.id);
    const title = await getSetting('publish_channel_title');
    return api.editMessageText({
      chat_id: message.chat.id, message_id: session.promptMessageId,
      rich_message: adminPanelMessage(title), reply_markup: adminPanelKeyboard(),
    });
  } catch (error) {
    return api.editMessageText({
      chat_id: message.chat.id, message_id: session.promptMessageId,
      rich_message: { blocks: [
        { type: 'heading', size: 2, text: '⚠️ Channel not connected' },
        { type: 'paragraph', text: String(error?.description || error?.message || 'Could not verify this channel.') },
        { type: 'paragraph', text: 'Check the channel ID and confirm that the bot is an administrator with permission to post.' },
      ] },
      reply_markup: { inline_keyboard: [[{ text: 'Try again', callback_data: 'sg:admin:configure' }, { text: 'Back', callback_data: 'sg:admin:home' }]] },
    });
  }
}
function validate(step, value) {
  const text = String(value || '').trim();
  if (step === 'handle') {
    const handle = text.startsWith('@') ? text.slice(1) : '';
    return /^[A-Za-z0-9_]{5,32}$/.test(handle) ? { value: '@' + handle } : { error: 'Enter a valid Telegram username in the format @username.' };
  }
  if (step === 'amount') return text.length > 0 && text.length <= 100 ? { value: text } : { error: 'Enter the amount involved (up to 100 characters), for example 250 USD or 3 GRAM.' };
  if (step === 'summary') return text.length >= 10 && text.length <= 700 ? { value: text } : { error: 'Please provide a summary between 10 and 700 characters.' };
  if (step === 'proof') {
    const username = /^@[A-Za-z0-9_]{5,32}$/.test(text);
    const link = /^(https?:\/\/)?(www\.)?t\.me\/[A-Za-z0-9_+/-]+(?:\?.*)?$/i.test(text);
    return (username || link) && text.length <= 300 ? { value: text } : { error: 'Send a public Telegram channel username such as @channelname or a t.me link.' };
  }
  return { error: 'This step is no longer available. Please start a new report.' };
}
export default async function (message) {
  if (!message?.chat || message.chat.type !== 'private' || !message.from?.id) return;
  const chatId = message.chat.id;
  const user = message.from;
  const text = typeof message.text === 'string' ? message.text.trim() : '';

  if (text && commandOf(text) === '/start') return showHome(chatId, user);
  if (text && commandOf(text) === '/admin') {
    if (!isAdmin(user.id)) return;
    await deleteAdminSession(user.id);
    return showAdminPanel(chatId);
  }
  if (text && commandOf(text) === '/resetdb') {
    if (!isAdmin(user.id)) return;
    return api.sendRichMessage({
      chat_id: chatId,
      rich_message: { blocks: [
        { type: 'heading', size: 2, text: '⚠️ Reset test data?' },
        { type: 'paragraph', text: 'This deletes all stored report drafts and reports. Your publishing channel configuration will be kept.' },
        { type: 'paragraph', text: 'Confirm only when you are sure. This cannot be undone.' },
      ] },
      reply_markup: { inline_keyboard: [[{ text: 'Confirm reset', callback_data: 'sg:admin:reset_confirm', style: 'danger' }, { text: 'Cancel', callback_data: 'sg:admin:home' }]] },
    });
  }

  if (isAdmin(user.id)) {
    const adminSession = await getAdminSession(user.id);
    if (adminSession?.step === 'channel' && adminSession.chatId === chatId) {
      return configureChannel(message, adminSession);
    }
  }

  if (text && commandOf(text) === '/cancel') {
    const draft = await getDraft(user.id);
    if (!draft) return showHome(chatId, user);
    await deleteDraft(user.id);
    return api.editMessageText({
      chat_id: chatId, message_id: draft.promptMessageId,
      rich_message: { blocks: [
        { type: 'heading', size: 2, text: '🛑 Report cancelled' },
        { type: 'paragraph', text: 'Your report has been cancelled. Nothing was submitted.' },
      ] },
      reply_markup: { inline_keyboard: [[{ text: '‹ Back to menu', callback_data: 'sg:home' }]] },
    });
  }

  const draft = await getDraft(user.id);
  if (!draft || draft.chatId !== chatId) {
    if (text) return api.sendMessage({ chat_id: chatId, text: 'Use /start to open the menu and begin a report.' });
    return;
  }
  const editing = String(draft.step).startsWith('edit_');
  const step = editing ? draft.step.slice(5) : draft.step;
  if (!['handle', 'amount', 'summary', 'proof'].includes(step) || ['submitting', 'publishing'].includes(draft.step)) return;
  if (!text || text.startsWith('/')) {
    if (message.message_id) await deleteInput(message);
    return api.editMessageText({
      chat_id: chatId, message_id: draft.promptMessageId,
      rich_message: { blocks: [
        { type: 'heading', size: 2, text: '⚠️ Text response required' },
        { type: 'paragraph', text: 'Please send your answer as a text message.' },
        ...promptMessage(draft.step).blocks,
      ] },
      reply_markup: { inline_keyboard: [[{ text: 'Cancel', callback_data: 'sg:cancel' }]] },
    });
  }
  const checked = validate(step, text);
  await deleteInput(message);
  if (checked.error) {
    return api.editMessageText({
      chat_id: chatId, message_id: draft.promptMessageId,
      rich_message: { blocks: [
        { type: 'heading', size: 2, text: '⚠️ Please check your entry' },
        { type: 'paragraph', text: checked.error },
        ...promptMessage(draft.step).blocks,
      ] },
      reply_markup: { inline_keyboard: [[{ text: 'Cancel', callback_data: 'sg:cancel' }]] },
    });
  }

  const field = step === 'handle' ? 'scammerHandle' : step === 'proof' ? 'proofChannel' : step;
  const next = editing ? 'preview' : ({ handle: 'amount', amount: 'summary', summary: 'proof', proof: 'preview' })[step];
  const updated = { ...draft, [field]: checked.value, step: next };
  await db.update(reportDrafts).set({ [field]: checked.value, step: next, updatedAt: new Date() })
    .where(eq(reportDrafts.userId, user.id)).run();

  if (next === 'preview') {
    return api.editMessageText({
      chat_id: chatId, message_id: draft.promptMessageId,
      rich_message: previewMessage(updated), reply_markup: previewKeyboard(),
    });
  }
  return api.editMessageText({
    chat_id: chatId, message_id: draft.promptMessageId,
    rich_message: promptMessage(next),
    reply_markup: { inline_keyboard: [[{ text: 'Cancel', callback_data: 'sg:cancel' }]] },
  });
}
