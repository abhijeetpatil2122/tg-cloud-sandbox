import { api, EndpointError } from 'sdk';
import { listSavedChats, removeSavedChat } from '../lib/storage.js';
import { openEditorButton } from '../lib/botMessages.js';

export default async function (input, ctx) {
  const user = ctx.initData?.user;
  if (!user?.id) throw new EndpointError('Open this Mini App from Telegram.', { code: 'TELEGRAM_AUTH_REQUIRED' });

  const chatId = Number(input?.chat_id);
  if (!Number.isSafeInteger(chatId) || chatId === 0) {
    throw new EndpointError('Invalid chat ID.', { code: 'INVALID_CHAT_ID' });
  }

  const savedChats = await listSavedChats(user.id);
  const saved = savedChats.find((chat) => String(chat.id) === String(chatId));
  await removeSavedChat(user.id, chatId);

  // Removal must succeed even if Telegram cannot deliver the optional notification.
  if (saved) {
    try {
      await api.sendRichMessage({
        chat_id: user.id,
        rich_message: {
          blocks: [
            {
              type: 'paragraph',
              text: ['Your channel ', { type: 'bold', text: saved.title || 'Untitled channel' }, ' has been removed from the editor.'],
            },
            openEditorButton(),
          ],
        },
      });
    } catch (error) {
      console.warn('Channel was removed, but the user notification could not be delivered:', error?.description || error?.message || String(error));
    }
  }

  return { ok: true };
}
