import { api, EndpointError } from 'sdk';
import { assertBotCanSend } from '../lib/chatAccess.js';
import { validateBlocks } from '../lib/validateBlocks.js';
import { trackEvent, upsertUser } from '../lib/storage.js';

export default async function (input, ctx) {
  const user = ctx.initData?.user;
  if (!user?.id) throw new EndpointError('Open this app from Telegram.', { code: 'TELEGRAM_AUTH_REQUIRED' });

  let blocks;
  try { blocks = validateBlocks(input?.blocks); }
  catch (error) { throw new EndpointError(error?.message || 'The message content is invalid.', { code: 'INVALID_MESSAGE' }); }

  const target = input?.target;
  let chatId;
  try {
    if (!target || target.type === 'private') chatId = user.id;
    else if (target.type === 'channel' && target.chat_id !== undefined && target.chat_id !== null) {
      const chat = await api.getChat({ chat_id: target.chat_id });
      await assertBotCanSend(chat, await api.getMe());
      chatId = chat.id;
    } else throw new EndpointError('Unknown send target.', { code: 'INVALID_TARGET' });

    const message = await api.sendRichMessage({ chat_id: chatId, rich_message: { blocks } });
    await upsertUser(user);
    await trackEvent(user.id, 'rich_message_sent', { chatId, metadata: { blockCount: blocks.length } });
    return { ok: true, message_id: message.message_id };
  } catch (error) {
    if (error instanceof EndpointError) throw error;
    console.error('sendRichMessage failed', { message: error?.message });
    throw new EndpointError(error?.description || error?.message || 'Could not send the Rich Message.', { code: 'SEND_FAILED' });
  }
}
