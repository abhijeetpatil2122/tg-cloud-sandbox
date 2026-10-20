import { EndpointError } from 'sdk';
import { removeSavedChat } from '../lib/storage.js';

export default async function (input, ctx) {
  const user = ctx.initData?.user;
  if (!user?.id) throw new EndpointError('Open this app from Telegram.', { code: 'TELEGRAM_AUTH_REQUIRED' });
  const chatId = Number(input?.chat_id);
  if (!Number.isSafeInteger(chatId) || chatId === 0) {
    throw new EndpointError('Invalid chat ID.', { code: 'INVALID_CHAT_ID' });
  }
  await removeSavedChat(user.id, chatId);
  return { ok: true };
}
