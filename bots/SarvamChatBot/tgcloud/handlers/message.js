import { api } from 'sdk';
import {
  completeGeneration,
  createGeneration,
  deleteGeneration,
  getBotSettings,
  isGenerationStopped,
  loadConversation,
  resetConversation,
  saveConversationTurn,
  saveGenerationPartial,
  saveSarvamKey,
  saveTavilyKey,
} from '../lib/conversation.js';
import { streamSarvamCompletion } from '../lib/ai.js';
import { buildSystemPrompt } from '../lib/prompts.js';
import { WEB_SEARCH_TOOL, runWebSearch } from '../lib/search.js';
import { errorMessage, helpMessage, startMessage } from '../lib/rich-messages.js';

function getCommand(text) {
  if (typeof text !== 'string' || !text.startsWith('/')) return null;
  return text.trim().split(/\s+/)[0].slice(1).split('@')[0].toLowerCase();
}

function getCommandValue(text, command) {
  const escaped = command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = typeof text === 'string'
    ? text.trim().match(new RegExp('^/' + escaped + '(?:@[A-Za-z0-9_]+)?\\s+([\\s\\S]+)$', 'i'))
    : null;
  return match?.[1]?.trim() || '';
}

async function sendRich(chatId, richMessage) {
  return await api.sendRichMessage({ chat_id: chatId, rich_message: richMessage });
}

async function sendDraft(chatId, draftId, richMessage) {
  await api.sendRichMessageDraft({
    chat_id: chatId,
    draft_id: draftId,
    rich_message: richMessage,
    can_stop: true,
    keep_on_stop: true,
  });
}

async function deliverFinal(chatId, answer) {
  try {
    await sendRich(chatId, { markdown: answer });
  } catch (error) {
    console.warn('Rich Markdown final delivery failed; retrying as a plain Rich Message:', {
      message: error?.description || error?.message || 'Rich Markdown rejected',
    });
    await sendRich(chatId, {
      blocks: [{ type: 'paragraph', text: answer }],
    });
  }
}

async function runAssistantTurn({ chatId, userTgId, draftId, text, settings, history }) {
  const messages = [
    { role: 'system', content: buildSystemPrompt({ webSearchEnabled: Boolean(settings.tavilyApiKey) }) },
    ...history,
    { role: 'user', content: text },
  ];

  const isStopped = () => isGenerationStopped(chatId, draftId);
  const onDraft = async (partial) => {
    try { await saveGenerationPartial(chatId, draftId, partial); } catch (error) {
      console.warn('Could not persist the latest draft text:', { message: error?.message || 'database update failed' });
    }
    await sendDraft(chatId, draftId, { markdown: partial });
  };

  const first = await streamSarvamCompletion({
    apiKey: settings.sarvamApiKey,
    messages,
    tools: settings.tavilyApiKey ? [WEB_SEARCH_TOOL] : null,
    onDraft,
    isStopped,
  });

  if (first.stopped || await isStopped()) return { stopped: true };

  let answer = first.content;
  if (first.toolCalls.length) {
    await sendDraft(chatId, draftId, {
      html: '<tg-thinking>Searching live sources…</tg-thinking>',
    });

    const toolCalls = first.toolCalls;
    const assistantToolMessage = {
      role: 'assistant',
      content: first.content || null,
      tool_calls: toolCalls,
    };
    const toolMessages = [];

    for (let index = 0; index < toolCalls.length; index += 1) {
      const call = toolCalls[index];
      let result;

      if (index > 0) {
        result = { error: 'Only one live web search is allowed per user message. Continue using the first search result.' };
      } else if (call.function.name !== 'web_search') {
        result = { error: 'This tool is not available.' };
      } else {
        try {
          result = await runWebSearch(settings.tavilyApiKey, call.function.arguments);
        } catch (error) {
          result = {
            error: Number(error?.status) === 429
              ? 'The live search provider is rate-limiting requests. Do not invent current facts; explain that live verification is temporarily unavailable.'
              : 'The live search provider is temporarily unavailable. Do not invent current facts; explain that live verification could not be completed.',
          };
        }
      }

      toolMessages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }

    if (await isStopped()) return { stopped: true };

    const finalMessages = [...messages, assistantToolMessage, ...toolMessages];
    const final = await streamSarvamCompletion({
      apiKey: settings.sarvamApiKey,
      messages: finalMessages,
      onDraft,
      isStopped,
    });
    if (final.stopped) return { stopped: true };
    answer = final.content;
  }

  if (!answer?.trim()) throw new Error('Sarvam returned an empty answer.');

  // Atomically claim completion. If the Stop update won the race, it has
  // already persisted the partial draft and this invocation must not duplicate it.
  const mayFinalize = await completeGeneration(chatId, draftId);
  if (!mayFinalize) return { stopped: true };

  await deliverFinal(chatId, answer.trim());

  try {
    await saveConversationTurn(userTgId, text, answer.trim());
  } catch (error) {
    console.warn('AI reply sent, but conversation history could not be saved:', {
      message: error?.description || error?.message || 'database write failed',
    });
  }

  return { stopped: false };
}

export default async function (message) {
  // Private-chat-only guard: do not touch storage or external APIs for groups.
  if (message?.chat?.type !== 'private') return;

  const chatId = message.chat.id;
  const userTgId = message.from?.id;
  if (!chatId || !userTgId || message.from?.is_bot) return;

  const text = typeof message.text === 'string' ? message.text.trim() : '';
  const command = getCommand(text);

  if (command === 'start') {
    const settings = await getBotSettings();
    await sendRich(chatId, startMessage(Boolean(settings?.sarvamApiKey), Boolean(settings?.tavilyApiKey)));
    return;
  }

  if (command === 'help') {
    const settings = await getBotSettings();
    await sendRich(chatId, helpMessage(Boolean(settings?.sarvamApiKey), Boolean(settings?.tavilyApiKey)));
    return;
  }

  if (command === 'setkey' || command === 'setsearchkey') {
    const apiKey = getCommandValue(text, command);
    try {
      await api.deleteMessage({ chat_id: chatId, message_id: message.message_id });
    } catch (error) {
      console.warn('Could not delete a credential command message:', {
        message: error?.description || error?.message || 'delete failed',
      });
    }

    if (!apiKey || apiKey.length < 12 || apiKey.length > 512) {
      await sendRich(chatId, errorMessage('The key format looks invalid. Send the command followed by the complete API key.'));
      return;
    }

    try {
      const result = command === 'setkey'
        ? await saveSarvamKey(userTgId, apiKey)
        : await saveTavilyKey(userTgId, apiKey);

      if (!result.ok) {
        await sendRich(chatId, errorMessage(
          command === 'setsearchkey' && result.reason === 'not_owner'
            ? 'Configure the Sarvam key first. Only the original bot configuration owner can add or rotate the search key.'
            : 'Only the original bot configuration owner can change API keys.',
        ));
        return;
      }

      await sendRich(chatId, {
        blocks: [
          { type: 'heading', size: 2, text: command === 'setkey' ? 'Sarvam key saved' : 'Live search key saved' },
          { type: 'paragraph', text: 'The credential has been stored. The command message was deleted where Telegram allowed it.' },
          { type: 'footer', text: 'Keys are never echoed or written to application logs.' },
        ],
      });
    } catch (error) {
      console.error('Could not save API key:', {
        message: error?.description || error?.message || 'database write failed',
      });
      await sendRich(chatId, errorMessage('I could not save that key. Make sure the latest database migration has been applied, then try again.'));
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

  if (!text || text.startsWith('/')) return;

  let settings;
  try {
    settings = await getBotSettings();
  } catch (error) {
    console.error('Could not read bot settings:', {
      message: error?.description || error?.message || 'database read failed',
    });
    await sendRich(chatId, errorMessage('The assistant is temporarily unavailable because its configuration could not be loaded.'));
    return;
  }

  if (!settings?.sarvamApiKey) {
    await sendRich(chatId, errorMessage('Sarvam is not configured yet. The bot owner must set the key using /setkey YOUR_SARVAM_API_KEY.'));
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

  const draftId = Math.max(1, Number(message.message_id) || 1);
  try {
    await createGeneration({ chatId, draftId, userTgId });
    await sendDraft(chatId, draftId, {
      html: '<tg-thinking>Thinking…</tg-thinking>',
    });

    await runAssistantTurn({ chatId, userTgId, draftId, text, settings, history });
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
      const stopped = await isGenerationStopped(chatId, draftId);
      if (!stopped) {
        const mayFinalize = await completeGeneration(chatId, draftId);
        if (mayFinalize) await sendRich(chatId, errorMessage(messageText));
      }
    } catch (sendError) {
      console.error('Could not send the AI error response:', {
        message: sendError?.description || sendError?.message || 'Telegram delivery failed',
      });
    }
  } finally {
    try { await deleteGeneration(chatId, draftId); } catch {}
  }
}
