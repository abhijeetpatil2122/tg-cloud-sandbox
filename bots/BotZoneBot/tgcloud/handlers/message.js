import { api } from 'sdk';
import { getCommandMessage } from '../lib/botMessages.js';
import { listSavedChats, saveChat } from '../lib/storage.js';

const KNOWN_COMMANDS = new Set(['start', 'help', 'howtouse', 'about']);
const SHARE_CHANNEL_REQUEST_ID = 4201;

const CHAT_SHARE_KEYBOARD = {
  keyboard: [[
    {
      text: '📢 Share Channel',
      request_chat: {
        request_id: SHARE_CHANNEL_REQUEST_ID,
        chat_is_channel: true,
        chat_is_created: true,
        user_administrator_rights: { can_post_messages: true },
        bot_administrator_rights: { can_post_messages: true },
        request_title: true,
        request_username: true,
        request_photo: true,
      },
    },
  ]],
  is_persistent: true,
  resize_keyboard: true,
  input_field_placeholder: 'Share Channel',
};

function confirmationMessage(chat, botCanPost, alreadySaved) {
  const title = typeof chat.title === 'string' && chat.title.trim()
    ? chat.title.trim()
    : 'Untitled channel';
  const username = typeof chat.username === 'string' && chat.username.trim()
    ? `@${chat.username.replace(/^@/, '')}`
    : 'No public username';
  const heading = alreadySaved ? 'Channel already connected' : 'Channel saved successfully';
  const blocks = [
    { type: 'heading', size: 2, text: `✅ ${heading}` },
    {
      type: 'paragraph',
      text: alreadySaved
        ? 'This channel was already in your saved chats. Its details have been refreshed.'
        : 'Your channel is now connected to Rich Message Editor and is ready to use.',
    },
    { type: 'divider' },
    {
      type: 'list',
      items: [
        { blocks: [{ type: 'paragraph', text: [{ type: 'bold', text: 'Channel' }, `: ${title}`] }] },
        { blocks: [{ type: 'paragraph', text: [{ type: 'bold', text: 'Username' }, `: ${username}`] }] },
        { blocks: [{ type: 'paragraph', text: [{ type: 'bold', text: 'Channel ID' }, `: ${chat.id}`] }] },
        { blocks: [{ type: 'paragraph', text: [{ type: 'bold', text: 'Bot status' }, `: ${botCanPost ? 'Administrator · can post messages' : 'Permission not verified'}`] }] },
      ],
    },
    { type: 'divider' },
    {
      type: 'footer',
      text: botCanPost
        ? 'You can now select this channel from the editor’s Send menu.'
        : 'Open channel settings and grant the bot permission to post messages.',
    },
  ];
  return { blocks };
}

function shareErrorMessage(error) {
  const detail = String(error?.description || error?.message || '').toLowerCase();
  if (/chat not found|chat_id_invalid|user not found/.test(detail)) {
    return 'I could not access that channel. Make sure it was created by your account and try again.';
  }
  if (/administrator|post messages|not enough rights|forbidden/.test(detail)) {
    return 'The channel was shared, but I could not verify the bot’s posting permission. Please check the bot’s channel administrator settings and share it again.';
  }
  return 'I could not finish connecting that channel right now. Please try sharing it again in a moment.';
}

export default async function (message) {
  const chatId = message?.chat?.id;
  if (!chatId || message.chat.type !== 'private') return;

  // Telegram sends a chat_shared service message after the user selects a channel.
  const shared = message.chat_shared;
  if (shared && Number.isSafeInteger(shared.chat_id) && shared.chat_id !== 0) {
    if (shared.request_id !== SHARE_CHANNEL_REQUEST_ID) {
      await api.sendMessage({
        chat_id: chatId,
        text: 'Please use the Share Channel button from /start to connect a channel.',
        reply_markup: CHAT_SHARE_KEYBOARD,
      });
      return;
    }

    try {
      // chat_shared intentionally contains limited metadata. Fetch the full Chat
      // object so the database receives the photo file ID used by the editor.
      const chat = await api.getChat({ chat_id: shared.chat_id });
      if (chat.type !== 'channel') {
        await api.sendMessage({
          chat_id: chatId,
          text: 'Please select a channel created by your account.',
          reply_markup: CHAT_SHARE_KEYBOARD,
        });
        return;
      }

      const me = await api.getMe();
      const member = await api.getChatMember({ chat_id: chat.id, user_id: me.id });
      const botCanPost = member.status === 'creator' ||
        (member.status === 'administrator' && member.can_post_messages === true);

      if (!botCanPost) {
        await api.sendMessage({
          chat_id: chatId,
          text: 'The channel was shared, but the bot does not have permission to post there. Please make it an administrator with only the “Post messages” permission, then share the channel again.',
          reply_markup: CHAT_SHARE_KEYBOARD,
        });
        return;
      }

      const existingChats = await listSavedChats(message.from.id);
      const alreadySaved = existingChats.some((saved) => String(saved.id) === String(chat.id));

      await saveChat(message.from.id, {
        ...chat,
        id: chat.id,
        title: chat.title || shared.title || 'Untitled channel',
        username: chat.username || shared.username || null,
        type: 'channel',
        photoFileId: chat.photo?.small_file_id || null,
      });

      await api.sendRichMessage({
        chat_id: chatId,
        rich_message: confirmationMessage({ ...chat, title: chat.title || shared.title || 'Untitled channel' }, botCanPost, alreadySaved),
        reply_markup: CHAT_SHARE_KEYBOARD,
      });
    } catch (error) {
      console.error('Failed to connect shared channel:', {
        message: error?.description || error?.message || String(error),
      });
      await api.sendMessage({
        chat_id: chatId,
        text: shareErrorMessage(error),
        reply_markup: CHAT_SHARE_KEYBOARD,
      });
    }
    return;
  }

  const text = typeof message.text === 'string' ? message.text.trim() : '';
  if (!text.startsWith('/')) return;
  const command = text.split(/\\s+/)[0].slice(1).split('@')[0].toLowerCase();
  if (!KNOWN_COMMANDS.has(command)) return;

  const reply = getCommandMessage(command, message.from);
  if (!reply) return;

  await api.sendRichMessage({
    chat_id: chatId,
    rich_message: { blocks: reply.blocks },
    ...(command === 'start' ? { reply_markup: CHAT_SHARE_KEYBOARD } : {}),
  });
}
