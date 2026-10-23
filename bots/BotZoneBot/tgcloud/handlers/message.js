import { api } from 'sdk';
import { getCommandMessage } from '../lib/botMessages.js';
import { saveChat } from '../lib/storage.js';

const KNOWN_COMMANDS = new Set(['start', 'help', 'howtouse', 'about']);
const SHARE_CHANNEL_REQUEST_ID = 4201;
const SHARE_GROUP_REQUEST_ID = 4202;

const CHAT_SHARE_KEYBOARD = {
  keyboard: [
    [
      {
        text: '📢 Share a channel',
        request_chat: {
          request_id: SHARE_CHANNEL_REQUEST_ID,
          chat_is_channel: true,
          user_administrator_rights: { can_post_messages: true },
          bot_administrator_rights: { can_post_messages: true },
          request_title: true,
          request_username: true,
        },
      },
      {
        text: '👥 Share a group',
        request_chat: {
          request_id: SHARE_GROUP_REQUEST_ID,
          chat_is_channel: false,
          bot_is_member: true,
          request_title: true,
          request_username: true,
        },
      },
    ],
  ],
  is_persistent: true,
  resize_keyboard: true,
  input_field_placeholder: 'Share a channel or group',
};

function chatShareConfirmation(chat, type) {
  const title = typeof chat.title === 'string' && chat.title.trim()
    ? chat.title.trim()
    : (chat.username ? `@${chat.username}` : 'Selected chat');
  const username = typeof chat.username === 'string' && chat.username.trim()
    ? ` (@${chat.username.replace(/^@/, '')})`
    : '';
  const kind = type === 'channel' ? 'channel' : 'group';
  const text = `Successfully connected ${kind}: ${title}${username}. It has been saved to your account and will appear in the editor's chat list.`;
  return { blocks: [{ type: 'paragraph', text }] };
}

export default async function (message) {
  const chatId = message?.chat?.id;
  if (!chatId || message.chat.type !== 'private') return;

  // Telegram sends a chat_shared service message after the user selects a chat.
  const shared = message.chat_shared;
  if (shared && Number.isSafeInteger(shared.chat_id) && shared.chat_id !== 0) {
    const requestId = shared.request_id;
    const type = requestId === SHARE_CHANNEL_REQUEST_ID
      ? 'channel'
      : requestId === SHARE_GROUP_REQUEST_ID
        ? 'group'
        : null;

    if (!type) {
      await api.sendMessage({
        chat_id: chatId,
        text: 'I received a shared chat, but could not identify the request. Please use the Share a channel or Share a group buttons from /start.',
      });
      return;
    }

    const title = typeof shared.title === 'string' && shared.title.trim()
      ? shared.title.trim()
      : (shared.username ? `@${shared.username}` : (type === 'channel' ? 'Untitled channel' : 'Untitled group'));

    try {
      await saveChat(message.from.id, {
        id: shared.chat_id,
        title,
        username: shared.username || null,
        type,
      });
      await api.sendRichMessage({
        chat_id: chatId,
        rich_message: chatShareConfirmation({ title, username: shared.username }, type),
        reply_markup: CHAT_SHARE_KEYBOARD,
      });
    } catch (error) {
      console.error('Failed to save shared chat:', error);
      await api.sendMessage({
        chat_id: chatId,
        text: 'Telegram shared the chat, but I could not save it right now. Please try sharing it again in a moment.',
        reply_markup: CHAT_SHARE_KEYBOARD,
      });
    }
    return;
  }

  const text = typeof message.text === 'string' ? message.text.trim() : '';
  if (!text.startsWith('/')) return;
  const command = text.split(/\s+/)[0].slice(1).split('@')[0].toLowerCase();
  if (!KNOWN_COMMANDS.has(command)) return;

  const reply = getCommandMessage(command, message.from);
  if (!reply) return;

  await api.sendRichMessage({
    chat_id: chatId,
    rich_message: { blocks: reply.blocks },
    ...(command === 'start' ? { reply_markup: CHAT_SHARE_KEYBOARD } : {}),
  });
}
