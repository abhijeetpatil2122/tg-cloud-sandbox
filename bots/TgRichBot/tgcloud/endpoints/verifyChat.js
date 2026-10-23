import { api, EndpointError } from 'sdk';
import { assertBotCanSend, SUPPORTED_CHAT_TYPES } from '../lib/chatAccess.js';
import { listSavedChats, saveChat } from '../lib/storage.js';
import { channelConnectionMessage } from '../lib/botMessages.js';

function normalizeChatReference(value) {
  if ((typeof value !== 'string' && typeof value !== 'number') || !String(value).trim()) {
    throw new EndpointError('Enter a channel or group username or ID.', { code: 'CHAT_ID_REQUIRED' });
  }

  const input = String(value).trim();
  if (/^-\d{1,20}$/.test(input)) return input;

  const username = input.replace(/^@/, '');
  if (/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username)) return `@${username}`;

  throw new EndpointError(
    'Enter a valid channel or group username (for example, @mychannel) or numeric chat ID (for example, -100123456789). Links and invite links are not supported.',
    { code: 'CHAT_REFERENCE_INVALID' }
  );
}

function humanizeTelegramError(error) {
  const detail = String(error?.description || error?.message || '').replace(/^(?:Bad Request|Forbidden|Error):\s*/i, '').trim();
  const message = detail.toLowerCase();

  if (/chat not found|chat_id_invalid|username.*invalid|invalid.*username/.test(message)) {
    return 'We couldn’t find that channel or group. Check the username or ID and try again.';
  }
  if (/bot must be an administrator|administrator in this channel|post messages permission|not enough rights to send messages|can.t post messages/.test(message)) {
    return 'The bot needs administrator permission to post in this channel. Check its channel permissions and try again.';
  }
  if (/bot must be a member|bot is not a member|not a member of the chat|user not found/.test(message)) {
    return 'Add the bot to that group or channel first, then try again.';
  }
  if (/restricted from sending|can.t send messages|write_forbidden/.test(message)) {
    return 'The bot does not have permission to send messages in that chat. Update its permissions and try again.';
  }
  if (/private chat|unsupported chat type/.test(message)) {
    return 'Please enter a channel or group, not a private chat.';
  }
  if (/timed? out|timeout|network|temporarily unavailable|internal server error/.test(message)) {
    return 'The chat could not be checked right now. Please try again in a moment.';
  }

  if (detail.startsWith('The bot ') || detail.startsWith('Add the bot ')) return detail;
  return 'We could not verify that chat. Check the username or ID and try again.';
}

export default async function (input, ctx) {
  const user = ctx.initData?.user;
  if (!user?.id) throw new EndpointError('Open this app from Telegram.', { code: 'TELEGRAM_AUTH_REQUIRED' });

  const chatId = normalizeChatReference(input?.chat_id);

  try {
    const chat = await api.getChat({ chat_id: chatId });
    if (!SUPPORTED_CHAT_TYPES.has(chat.type)) {
      throw new EndpointError('Please enter a channel or group, not a private chat.', { code: 'UNSUPPORTED_CHAT_TYPE' });
    }
    await assertBotCanSend(chat, await api.getMe());

    const existingChats = await listSavedChats(user.id);
    const alreadySaved = existingChats.some((saved) => String(saved.id) === String(chat.id));
    const savedChannel = {
      ...chat,
      id: chat.id,
      title: chat.title || 'Untitled chat',
      username: chat.username || null,
      type: chat.type,
      photoFileId: chat.photo?.small_file_id || null,
    };
    await saveChat(user.id, savedChannel);

    // The channel is saved before notification delivery. A notification failure
    // must not turn a successful verification into an apparent add failure.
    try {
      await api.sendRichMessage({
        chat_id: user.id,
        rich_message: channelConnectionMessage(savedChannel, alreadySaved),
      });
    } catch (notificationError) {
      console.warn('Chat saved from Mini App, but Rich Message notification failed:', {
        message: notificationError?.description || notificationError?.message || String(notificationError),
      });
      try {
        await api.sendMessage({
          chat_id: user.id,
          text: `Channel “${savedChannel.title}” ${alreadySaved ? 'is already connected' : 'has been saved successfully'}. You can now use it in Rich Message Editor.`,
        });
      } catch (fallbackError) {
        console.error('Chat saved from Mini App, but notification fallback also failed:', {
          message: fallbackError?.description || fallbackError?.message || String(fallbackError),
        });
      }
    }

    return { ok: true, channel: {
      id: chat.id, title: savedChannel.title, username: savedChannel.username,
      type: chat.type, photoFileId: savedChannel.photoFileId
    }};
  } catch (error) {
    if (error instanceof EndpointError) throw error;
    console.error('verifyChat failed', { message: error?.message });
    throw new EndpointError(humanizeTelegramError(error), { code: 'CHAT_VERIFICATION_FAILED' });
  }
}
