import { api, EndpointError } from 'sdk';
import { listSavedChats, removeSavedChat } from '../lib/storage.js';

export default async function (input, ctx) {
  const user = ctx.initData?.user;
  if (!user?.id) throw new EndpointError('Open this app from Telegram.', { code: 'TELEGRAM_AUTH_REQUIRED' });

  const chatId = Number(input?.chat_id);
  if (!Number.isSafeInteger(chatId) || chatId === 0) {
    throw new EndpointError('Invalid chat ID.', { code: 'INVALID_CHAT_ID' });
  }

  const savedChats = await listSavedChats(user.id);
  const saved = savedChats.find((chat) => String(chat.id) === String(chatId));
  await removeSavedChat(user.id, chatId);

  // Removal must succeed even if the user has blocked the bot or Telegram
  // cannot deliver the optional confirmation message.
  if (saved) {
    try {
      const title = saved.title || 'Untitled channel';
      const username = saved.username ? `@${String(saved.username).replace(/^@/, '')}` : 'No public username';
      await api.sendRichMessage({
        chat_id: user.id,
        rich_message: {
          blocks: [
            { type: 'heading', size: 2, text: '🗑️ Channel removed' },
            { type: 'paragraph', text: 'This channel has been removed from your saved chats in Rich Message Editor.' },
            { type: 'divider' },
            {
              type: 'list',
              items: [
                { blocks: [{ type: 'paragraph', text: [{ type: 'bold', text: 'Channel' }, `: ${title}`] }] },
                { blocks: [{ type: 'paragraph', text: [{ type: 'bold', text: 'Username' }, `: ${username}`] }] },
                { blocks: [{ type: 'paragraph', text: [{ type: 'bold', text: 'Channel ID' }, `: ${saved.id}`] }] },
              ],
            },
            { type: 'footer', text: 'The bot’s administrator access in Telegram has not been changed. You can add this channel again from the editor.' },
          ],
        },
      });
    } catch (error) {
      console.warn('Channel was removed, but the user notification could not be delivered:', error?.description || error?.message || String(error));
    }
  }

  return { ok: true };
}
