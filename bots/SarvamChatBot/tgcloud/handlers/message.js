import { api } from 'sdk';
import { getBotSettings, loadConversation, resetConversation, saveConversationTurn, saveSarvamKey } from '../lib/conversation.js';
import { streamSarvamReply } from '../lib/ai.js';
import { SYSTEM_PROMPT } from '../lib/prompts.js';
import { errorMessage, helpMessage, startMessage } from '../lib/rich-messages.js';

function getCommand(text) {
  if (typeof text !== 'string' || !text.startsWith('/')) return null;
  return text.trim().split(/\s+/)[0].slice(1).split('@')[0].toLowerCase();
}

function getSetKeyValue(text) {
  const match = typeof text === 'string'
    ? text.trim().match(/^\/setkey(?:@[A-Za-z0-9_]+)?\s+([\s\S]+)$/i)
    : null;
  return match?.[1]?.trim() || '';
}

async function sendRich(chatId, richMessage) {
  await api.sendRichMessage({ chat_id: chatId, rich_message: richMessage });
}

export default async function (message) {
  // Private-chat-only guard: no database or network work for groups/channels.
  if (message?.chat?.type !== 'private') return;

  const chatId = message.chat.id;
  const userTgId = message.from?.id;
  if (!chatId || !userTgId) return;

  const text = typeof message.text === 'string' ? message.text.trim() : '';
  const command = getCommand(text);

  if (command === 'start') {
    const settings = await getBotSettings();
    await sendRich(chatId, startMessage(Boolean(settings?.sarvamApiKey)));
    return;
  }

  if (command === 'help') {
    const settings = await getBotSettings();
    await sendRich(chatId, helpMessage(Boolean(settings?.sarvamApiKey)));
    return;
  }

  if (command === 'setkey') {
    const apiKey = getSetKeyValue(text);
    try {
      await api.deleteMessage({ chat_id: chatId, message_id: message.message_id });
    } catch (error) {
      console.warn('Could not delete the Sarvam key command message:', {
        message: error?.description || error?.message || 'delete failed',
      });
    }

    if (!apiKey || apiKey.length < 12 || apiKey.length > 512) {
      await sendRich(chatId, errorMessage('The API key format looks invalid. Send /setkey followed by your Sarvam API key.'));
      return;
    }

    try {
      const result = await saveSarvamKey(userTgId, apiKey);
      if (!result.ok) {
        await sendRich(chatId, errorMessage('Only the user who initially configured this bot can rotate its Sarvam API key.'));
        return;
      }
      await sendRich(chatId, {
        blocks: [
          { type: 'heading', size: 2, text: result.created ? 'Sarvam configured' : 'Sarvam key updated' },
          { type: 'paragraph', text: 'The API key has been stored. Your credential message was removed where Telegram allowed it.' },
          { type: 'footer', text: 'The key is never echoed or written to application logs.' },
        ],
      });
    } catch (error) {
      console.error('Could not store Sarvam configuration:', {
        message: error?.description || error?.message || 'database write failed',
      });
      await sendRich(chatId, errorMessage('I could not save the Sarvam key. Make sure the initial database migration has been applied, then try again.'));
    }
    return;
  }

  if (command === 'reset') {
    try {
      await resetConversation(userTgId);
      await sendRich(chatId, {
        blocks: [
          { type: 'heading', size: 2, text: 'Conversation cleared' },
          { type: 'paragraph', text: 'Your saved conversation history has been deleted. You can start a fresh conversation now.' },
        ],
      });
    } catch (error) {
      console.error('Could not reset conversation history:', {
        message: error?.description || error?.message || 'database operation failed',
      });
      await sendRich(chatId, errorMessage('I could not clear your conversation right now.'));
    }
    return;
  }

  if (!text || text.startsWith('/') || message.from?.is_bot) return;

  let settings;
  try {
    settings = await getBotSettings();
  } catch (error) {
    console.error('Could not read Sarvam settings:', {
      message: error?.description || error?.message || 'database read failed',
    });
    await sendRich(chatId, errorMessage('The assistant is temporarily unavailable because its configuration could not be loaded.'));
    return;
  }

  if (!settings?.sarvamApiKey) {
    await sendRich(chatId, {
      blocks: [{ type: 'paragraph', text: 'Sarvam is not configured yet. The bot owner must set the API key using /setkey YOUR_SARVAM_API_KEY.' }],
    });
    return;
  }

  let history;
  try {
    history = await loadConversation(userTgId);
  } catch (error) {
    console.error('Could not load conversation history:', {
      message: error?.description || error?.message || 'database read failed',
    });
    await sendRich(chatId, errorMessage('I could not load your conversation history. Please try again.'));
    return;
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: text },
  ];

  const draftId = Math.max(1, Number(message.message_id) || 1);
  let draftEnabled = true;

  try {
    try {
      await api.sendRichMessageDraft({
        chat_id: chatId,
        draft_id: draftId,
        rich_message: { html: '<tg-thinking>Thinking…</tg-thinking>' },
      });
    } catch (error) {
      draftEnabled = false;
      console.warn('Initial Rich draft could not be shown:', {
        message: error?.description || error?.message || 'draft unavailable',
      });
    }

    const answer = await streamSarvamReply({
      apiKey: settings.sarvamApiKey,
      messages,
      onDraft: async (partial) => {
        if (!draftEnabled) return;
        await api.sendRichMessageDraft({
          chat_id: chatId,
          draft_id: draftId,
          rich_message: { markdown: partial },
        });
      },
    });

    await sendRich(chatId, { markdown: answer });

    try {
      await saveConversationTurn(userTgId, text, answer);
    } catch (error) {
      console.warn('AI reply sent, but conversation history could not be saved:', {
        message: error?.description || error?.message || 'database write failed',
      });
    }
  } catch (error) {
    console.error('Sarvam response failed:', {
      status: error?.status || null,
      message: error?.description || error?.message || 'upstream request failed',
    });

    const status = Number(error?.status);
    let messageText = 'I could not generate a response right now. Please try again shortly.';
    if (status === 401 || status === 403) {
      messageText = 'Sarvam rejected the configured API key. The bot owner can update it using /setkey YOUR_SARVAM_API_KEY.';
    } else if (status === 429) {
      messageText = 'Sarvam is receiving too many requests right now. Please wait a little and try again.';
    }

    try {
      await sendRich(chatId, errorMessage(messageText));
    } catch (sendError) {
      console.error('Could not send the AI error response:', {
        message: sendError?.description || sendError?.message || 'Telegram delivery failed',
      });
    }
  }
}
