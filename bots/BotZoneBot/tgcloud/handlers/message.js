import { api } from 'sdk';
import { getCommandMessage, channelConnectionMessage } from '../lib/botMessages.js';
import { listSavedChats, saveChat } from '../lib/storage.js';

const KNOWN_COMMANDS = new Set(['start', 'help', 'howtouse', 'about', 'mychannel']);
const SHARE_CHANNEL_REQUEST_ID = 4201;

const CHAT_SHARE_KEYBOARD = {
  keyboard: [[
    {
      text: '➕ Add Channel',
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
  input_field_placeholder: 'Add Channel',
};

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

function channelListMessage(channels) {
  const blocks = [{ type: 'heading', size: 2, text: 'Your connected channels' }];

  if (!channels.length) {
    blocks.push({
      type: 'paragraph',
      text: 'You have not added any channels yet. Use the Add Channel button below or add one from the editor settings.',
    });
    return { blocks };
  }

  blocks.push({
    type: 'paragraph',
    text: `You have ${channels.length} connected channel${channels.length === 1 ? '' : 's'}.`,
  });

  blocks.push({
    type: 'list',
    items: channels.map((channel) => {
      const details = [{
        type: 'paragraph',
        text: [{ type: 'bold', text: channel.title || 'Untitled channel' }],
      }];
      if (typeof channel.username === 'string' && channel.username.trim()) {
        details.push({
          type: 'paragraph',
          text: [{ type: 'code', text: `@${channel.username.replace(/^@/, '')}` }],
        });
      }
      details.push({
        type: 'paragraph',
        text: [{ type: 'code', text: String(channel.id) }],
      });
      return { blocks: details };
    }),
  });

  return { blocks };
}

export default async function (message) {
  const chatId = message?.chat?.id;
  if (!chatId || message.chat.type !== 'private') return;

  // Telegram sends a chat_shared service message after the user selects a channel.
  const shared = message.chat_shared;
  if (shared && Number.isSafeInteger(shared.chat_id) && shared.chat_id !== 0) {
    if (Number(shared.request_id) !== SHARE_CHANNEL_REQUEST_ID) {
      await api.sendMessage({
        chat_id: chatId,
        text: 'Please use the Add Channel button from /start to connect a channel.',
        reply_markup: CHAT_SHARE_KEYBOARD,
      });
      return;
    }

    let chat;
    let alreadySaved;

    try {
      // chat_shared already contains the selected chat's requested title,
      // username, and photo. Use these as a reliable fallback if getChat
      // cannot resolve the just-shared chat immediately.
      const sharedPhoto = Array.isArray(shared.photo) ? shared.photo[0]?.file_id || null : null;
      chat = {
        id: shared.chat_id,
        type: 'channel',
        title: shared.title || 'Untitled channel',
        username: shared.username || null,
        photoFileId: sharedPhoto,
      };

      try {
        const fullChat = await api.getChat({ chat_id: shared.chat_id });
        if (fullChat?.type && fullChat.type !== 'channel') {
          await api.sendMessage({
            chat_id: chatId,
            text: 'Please select a channel created by your account.',
            reply_markup: CHAT_SHARE_KEYBOARD,
          });
          return;
        }
        chat = {
          ...chat,
          ...fullChat,
          id: shared.chat_id,
          type: 'channel',
          title: fullChat?.title || shared.title || 'Untitled channel',
          username: fullChat?.username || shared.username || null,
          photoFileId: fullChat?.photo?.small_file_id || sharedPhoto || null,
        };
      } catch (lookupError) {
        // The request_chat button itself constrains the selection to a channel
        // owned by the user and requests the bot's posting right. Do not make a
        // transient metadata lookup failure block saving the shared channel.
        console.warn('Could not enrich shared channel metadata; using chat_shared data:', {
          message: lookupError?.description || lookupError?.message || String(lookupError),
        });
      }

      const existingChats = await listSavedChats(message.from.id);
      alreadySaved = existingChats.some((saved) => String(saved.id) === String(chat.id));

      await saveChat(message.from.id, {
        ...chat,
        id: chat.id,
        title: chat.title || 'Untitled channel',
        username: chat.username || null,
        type: 'channel',
        photoFileId: chat.photoFileId || chat.photo?.small_file_id || null,
      });
    } catch (error) {
      console.error('Failed to save shared channel:', {
        message: error?.description || error?.message || String(error),
      });
      await api.sendMessage({
        chat_id: chatId,
        text: shareErrorMessage(error),
        reply_markup: CHAT_SHARE_KEYBOARD,
      });
      return;
    }

    // Saving and notifying are separate: a Rich Message delivery problem must
    // never tell the user that a channel failed to connect after it was saved.
    try {
      await api.sendRichMessage({
        chat_id: chatId,
        rich_message: channelConnectionMessage(chat, alreadySaved),
        reply_markup: CHAT_SHARE_KEYBOARD,
      });
    } catch (notificationError) {
      console.warn('Channel saved, but Rich Message notification failed:', {
        message: notificationError?.description || notificationError?.message || String(notificationError),
      });
      try {
        await api.sendMessage({
          chat_id: chatId,
          text: `Channel “${chat.title || 'Untitled channel'}” ${alreadySaved ? 'is already connected' : 'has been saved successfully'}. You can now use it in Rich Message Editor.`,
          reply_markup: CHAT_SHARE_KEYBOARD,
        });
      } catch (fallbackError) {
        console.error('Channel saved, but notification fallback also failed:', {
          message: fallbackError?.description || fallbackError?.message || String(fallbackError),
        });
      }
    }
    return;
  }

  const text = typeof message.text === 'string' ? message.text.trim() : '';
  if (!text.startsWith('/')) return;
  const command = text.split(/\s+/)[0].slice(1).split('@')[0].toLowerCase();
  if (!KNOWN_COMMANDS.has(command)) return;

  if (command === 'mychannel') {
    try {
      const channels = (await listSavedChats(message.from.id))
        .filter((saved) => saved.type === 'channel');
      await api.sendRichMessage({
        chat_id: chatId,
        rich_message: channelListMessage(channels),
        reply_markup: CHAT_SHARE_KEYBOARD,
      });
    } catch (error) {
      console.error('Failed to list user channels:', {
        message: error?.description || error?.message || String(error),
      });
      await api.sendMessage({
        chat_id: chatId,
        text: 'I could not load your connected channels right now. Please try again in a moment.',
        reply_markup: CHAT_SHARE_KEYBOARD,
      });
    }
    return;
  }

  const reply = getCommandMessage(command, message.from);
  if (!reply) return;

  await api.sendRichMessage({
    chat_id: chatId,
    rich_message: { blocks: reply.blocks },
    ...(command === 'start' ? { reply_markup: CHAT_SHARE_KEYBOARD } : {}),
  });
}

