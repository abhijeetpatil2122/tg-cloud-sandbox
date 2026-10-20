import { api } from 'sdk';
import { getCommandMessage } from '../lib/botMessages.js';
import { consumeShareRequest, saveChat, trackEvent, upsertUser } from '../lib/storage.js';
import { assertBotCanSend } from '../lib/chatAccess.js';

const KNOWN_COMMANDS = new Set(['start', 'help', 'howtouse', 'about']);

export default async function (message) {
  const chatId = message?.chat?.id;
  if (!chatId || message.chat.type !== 'private') return;
  const user = message.from;
  if (user?.id) await upsertUser(user);

  if (message.chat_shared) {
    const shared = message.chat_shared;
    const request = await consumeShareRequest(shared.request_id, user?.id);
    if (!request) {
      await api.sendMessage({ chat_id: chatId, text: 'That channel-share request has expired. Please start again from the Mini App.' });
      return;
    }
    try {
      const chat = await api.getChat({ chat_id: shared.chat_id });
      await assertBotCanSend(chat, await api.getMe());
      await saveChat(user.id, chat, 'shared');
      await trackEvent(user.id, 'chat_shared', { chatId: chat.id, metadata: { type: chat.type } });
      await api.sendMessage({
        chat_id: chatId,
        text: `Connected “${chat.title || shared.title || 'your channel'}”. It is now saved in the editor's channel list.`,
        reply_markup: { remove_keyboard: true }
      });
    } catch (error) {
      console.error('chat_shared processing failed', { message: error?.message });
      await api.sendMessage({
        chat_id: chatId,
        text: error?.description || error?.message || 'I could not verify that I can post to the selected channel. Please check the bot permissions and try again.',
        reply_markup: { remove_keyboard: true }
      });
    }
    return;
  }

  const text = typeof message.text === 'string' ? message.text.trim() : '';
  if (!text.startsWith('/')) return;
  const command = text.split(/\s+/)[0].slice(1).split('@')[0].toLowerCase();
  if (!KNOWN_COMMANDS.has(command)) return;
  await trackEvent(user?.id, 'command', { metadata: { command } });
  const reply = getCommandMessage(command, user);
  if (!reply) return;
  await api.sendRichMessage({ chat_id: chatId, rich_message: { blocks: reply.blocks } });
}
