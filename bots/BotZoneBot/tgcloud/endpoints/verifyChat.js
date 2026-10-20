import { api, EndpointError } from 'sdk';
import { assertBotCanSend, SUPPORTED_CHAT_TYPES } from '../lib/chatAccess.js';
import { saveChat, trackEvent, upsertUser } from '../lib/storage.js';

export default async function (input, ctx) {
  const user = ctx.initData?.user;
  if (!user?.id) throw new EndpointError('Open this app from Telegram.', { code: 'TELEGRAM_AUTH_REQUIRED' });
  const chatId = input?.chat_id;
  if ((typeof chatId !== 'string' && typeof chatId !== 'number') || !String(chatId).trim()) {
    throw new EndpointError('Enter a username or chat ID.', { code: 'CHAT_ID_REQUIRED' });
  }

  try {
    const chat = await api.getChat({ chat_id: chatId });
    if (!SUPPORTED_CHAT_TYPES.has(chat.type)) {
      throw new EndpointError('That has to be a channel, group, or supergroup — not a private chat.', { code: 'UNSUPPORTED_CHAT_TYPE' });
    }
    await assertBotCanSend(chat, await api.getMe());
    await upsertUser(user);
    await saveChat(user.id, chat, 'manual');
    await trackEvent(user.id, 'chat_verified', { chatId: chat.id, metadata: { type: chat.type, source: 'manual' } });
    return { ok: true, channel: {
      id: chat.id, title: chat.title || 'Untitled chat', username: chat.username || null,
      type: chat.type, photoFileId: chat.photo?.small_file_id || null
    }};
  } catch (error) {
    if (error instanceof EndpointError) throw error;
    console.error('verifyChat failed', { message: error?.message });
    throw new EndpointError(error?.description || error?.message || 'Could not verify this chat.', { code: 'CHAT_VERIFICATION_FAILED' });
  }
}
