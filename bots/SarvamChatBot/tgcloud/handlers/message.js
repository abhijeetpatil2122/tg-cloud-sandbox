import { api } from 'sdk';
import {
  completeGeneration,
  createGeneration,
  deleteGeneration,
  getActiveGenerationForUser,
  getBotSettings,
  getGeneration,
  isGenerationStopped,
  loadConversation,
  resetConversation,
  recoverInterruptedGenerations,
  saveConversationAssistantMessage,
  saveConversationUserMessage,
  saveGenerationPartial,
  saveSarvamKey,
  saveTavilyKey,
} from '../lib/conversation.js';
import { streamSarvamCompletion } from '../lib/ai.js';
import { buildSystemPrompt } from '../lib/prompts.js';
import { WEB_SEARCH_TOOL, runWebSearch } from '../lib/search.js';
import { errorMessage, helpMessage, startMessage } from '../lib/rich-messages.js';

function getCommand(message) {
  const text = typeof message?.text === 'string' ? message.text.trim() : '';
  if (!text.startsWith('/')) return null;

  // Prefer Telegram's command entity when present; fall back to a strict
  // leading-command parser for clients that omit entities.
  const entity = (message.entities || []).find((item) =>
    item.type === 'bot_command' && item.offset === 0,
  );
  const raw = entity
    ? text.slice(0, entity.length)
    : (text.match(/^\/[A-Za-z0-9_]+(?:@[A-Za-z0-9_]+)?/) || [])[0];
  if (!raw) return null;

  const [name, addressedBot] = raw.slice(1).split('@');
  if (addressedBot && message.bot_username
    && addressedBot.toLowerCase() !== message.bot_username.toLowerCase()) return null;
  return name.toLowerCase();
}

function getCommandValue(text, command) {
  if (typeof text !== 'string') return '';
  const pattern = new RegExp('^/' + command + '(?:@[A-Za-z0-9_]+)?(?:\\s+([\\s\\S]+))?$', 'i');
  const match = text.trim().match(pattern);
  return match?.[1]?.trim() || '';
}

async function ensureBotCommands() {
  try {
    await api.setMyCommands({
      commands: [
        { command: 'start', description: 'Start the assistant' },
        { command: 'help', description: 'How to use the assistant' },
        { command: 'reset', description: 'Clear your conversation' },
      ],
    });
  } catch (error) {
    console.warn('Could not refresh the Telegram command menu:', {
      message: error?.description || error?.message || 'command registration unavailable',
    });
  }
}
async function sendRich(chatId, richMessage) {
  return await api.sendRichMessage({ chat_id: chatId, rich_message: richMessage });
}

async function sendDraft(chatId, draftId, richMessage) {
  try {
    await api.sendRichMessageDraft({
      chat_id: chatId,
      draft_id: draftId,
      rich_message: richMessage,
      can_stop: true,
      keep_on_stop: true,
    });
    return true;
  } catch (error) {
    // Some bot accounts cannot send custom emoji. Retry the same thinking state
    // with its standard Unicode fallback before disabling draft previews.
    if (typeof richMessage?.html === 'string' && richMessage.html.includes('<tg-emoji')) {
      const fallbackHtml = richMessage.html.replace(
        /<tg-emoji[^>]*>([\s\S]*?)<\/tg-emoji>/g,
        '$1',
      );
      try {
        await api.sendRichMessageDraft({
          chat_id: chatId,
          draft_id: draftId,
          rich_message: { html: fallbackHtml },
          can_stop: true,
          keep_on_stop: true,
        });
        return true;
      } catch (fallbackError) {
        console.warn('Custom and standard thinking emoji drafts both failed:', {
          message: fallbackError?.description || fallbackError?.message || 'draft unavailable',
        });
        return false;
      }
    }

    // Drafts are only previews. A preview failure must never cancel the AI
    // request or prevent its permanent sendRichMessage response.
    console.warn('Rich draft update failed; continuing generation:', {
      message: error?.description || error?.message || 'draft unavailable',
    });
    return false;
  }
}

const THINKING_ACTIONS = {
  thinking: { label: 'Thinking…', emojis: ['🧠', '💭'] },
  coding: { label: 'Working on the code…', emojis: ['💻', '⌨️', '⚙️'] },
  writing: { label: 'Preparing the response…', emojis: ['✍️', '📝'] },
  analysis: { label: 'Analyzing…', emojis: ['📊', '🔬', '🧠'] },
  design: { label: 'Working on the design…', emojis: ['🎨', '🖌️'] },
  search: { label: 'Searching live sources…', emojis: ['🔎', '🔍', '🌐'] },
};

function detectThinkingAction(text) {
  if (/\b(code|coding|program|script|function|bot|api|debug|error|implement|build|deploy)\b/i.test(text)) return 'coding';
  if (/\b(write|draft|rewrite|email|post|article|story|document|proposal)\b/i.test(text)) return 'writing';
  if (/\b(analy[sz]e|analysis|compare|review|data|statistics|calculate|research)\b/i.test(text)) return 'analysis';
  if (/\b(design|logo|mockup|layout|visual|image)\b/i.test(text)) return 'design';
  return 'thinking';
}

async function thinkingDraft(action) {
  const config = THINKING_ACTIONS[action] || THINKING_ACTIONS.thinking;
  const fallback = config.emojis[0];
  try {
    const stickerSet = await api.getStickerSet({ name: 'AIActions' });
    const sticker = (stickerSet?.stickers || []).find((item) =>
      config.emojis.includes(item.emoji) && item.custom_emoji_id,
    );
    if (sticker?.custom_emoji_id) {
      return { html: `<tg-thinking><tg-emoji emoji-id="${sticker.custom_emoji_id}">${fallback}</tg-emoji> ${config.label}</tg-thinking>` };
    }
  } catch (error) {
    console.warn('Could not load Telegram AI Actions emoji pack; using standard emoji:', {
      message: error?.description || error?.message || 'sticker set unavailable',
    });
  }
  return { html: `<tg-thinking>${fallback} ${config.label}</tg-thinking>` };
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

async function runAssistantTurn({ chatId, userTgId, draftId, text, settings, history, initialDraft }) {
  const messages = [
    { role: 'system', content: buildSystemPrompt({ webSearchEnabled: Boolean(settings.tavilyApiKey) }) },
    ...history,
    { role: 'user', content: text },
  ];

  const isStopped = () => isGenerationStopped(chatId, draftId);
  let currentDraft = initialDraft || { html: '<tg-thinking>🧠 Thinking…</tg-thinking>' };
  const onKeepAlive = async () => {
    const sent = await sendDraft(chatId, draftId, currentDraft);
    if (!sent) throw new Error('Rich draft keep-alive is unavailable.');
  };
  const onDraft = async (partial) => {
    try { await saveGenerationPartial(chatId, draftId, partial); } catch (error) {
      console.warn('Could not persist the latest draft text:', { message: error?.message || 'database update failed' });
    }
    currentDraft = { markdown: partial };
    const sent = await sendDraft(chatId, draftId, currentDraft);
    if (!sent) throw new Error('Rich draft preview is unavailable.');
  };

  const first = await streamSarvamCompletion({
    apiKey: settings.sarvamApiKey,
    messages,
    tools: settings.tavilyApiKey ? [WEB_SEARCH_TOOL] : null,
    onDraft,
    onKeepAlive,
    isStopped,
  });

  if (first.stopped || await isStopped()) return { stopped: true };

  let answer = first.content;
  let incomplete = Boolean(first.incomplete);
  if (first.toolCalls.length) {
    currentDraft = await thinkingDraft('search');
    await sendDraft(chatId, draftId, currentDraft);

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
      onKeepAlive,
      isStopped,
    });
    if (final.stopped) return { stopped: true };
    answer = final.content;
    incomplete = Boolean(final.incomplete);
  }

  if (!answer?.trim()) throw new Error('Sarvam returned an empty answer.');
  if (incomplete) {
    answer = `${answer.trim()}\n\n_This response reached the model or runtime output boundary before a normal completion marker. Ask me to continue from where it stopped._`;
  }

  // Save the full final text before claiming completion. If the Serverless
  // invocation is terminated between the state transition and Telegram delivery,
  // stale recovery can still send the complete answer on the next user message.
  try {
    await saveGenerationPartial(chatId, draftId, answer.trim());
  } catch (error) {
    console.warn('Could not checkpoint the final answer before delivery:', {
      message: error?.message || 'database update failed',
    });
  }

  // Atomically claim completion. If the Stop update won the race, it has
  // already persisted the partial draft and this invocation must not duplicate it.
  const mayFinalize = await completeGeneration(chatId, draftId);
  if (!mayFinalize) return { stopped: true };

  await deliverFinal(chatId, answer.trim());

  try {
    await saveConversationAssistantMessage(userTgId, answer.trim());
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
  const command = getCommand(message);

  if (command === 'start') {
    await ensureBotCommands();
    const settings = await getBotSettings();
    await sendRich(chatId, startMessage(Boolean(settings?.sarvamApiKey), Boolean(settings?.tavilyApiKey)));
    return;
  }

  if (command === 'help') {
    await ensureBotCommands();
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

  if (text.length > 12000) {
    await sendRich(chatId, errorMessage('That message is too long for one request. Please split it into smaller parts and send them separately.'));
    return;
  }

  try {
    const interrupted = await recoverInterruptedGenerations(userTgId);
    for (const generation of interrupted) {
      const partial = typeof generation.partialText === 'string'
        ? generation.partialText.trim().slice(0, 27000)
        : '';
      if (partial) {
        await deliverFinal(
          chatId,
          `${partial}\n\n_The previous generation was interrupted by the Serverless runtime. This is the recovered partial answer. You can ask me to continue._`,
        );
        await saveConversationAssistantMessage(userTgId, partial);
      } else {
        const recoveryNotice = 'The previous response was interrupted before any answer text could be saved. You can ask me to continue the original request.';
        await sendRich(chatId, errorMessage(recoveryNotice));
        await saveConversationAssistantMessage(userTgId, recoveryNotice);
      }
      await deleteGeneration(generation.chatId, generation.draftId);
    }

    const active = await getActiveGenerationForUser(userTgId);
    if (active) {
      await sendRich(chatId, errorMessage('You already have an answer being generated. Wait for it to finish or press Stop on its draft before sending another question.'));
      return;
    }
  } catch (error) {
    console.error('Could not check active generation state:', {
      message: error?.description || error?.message || 'database read failed',
    });
    await sendRich(chatId, errorMessage('I could not check whether another answer is still running. Please try again shortly.'));
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
  let generationCreated = false;
  let userMessageSaved = false;
  try {
    await createGeneration({ chatId, draftId, userTgId });
    generationCreated = true;
    await saveConversationUserMessage(userTgId, text);
    userMessageSaved = true;
    const initialDraft = await thinkingDraft(detectThinkingAction(text));
    await sendDraft(chatId, draftId, initialDraft);

    await runAssistantTurn({ chatId, userTgId, draftId, text, settings, history, initialDraft });
  } catch (error) {
    console.error('Sarvam response failed:', {
      status: error?.status || null,
      message: error?.description || error?.message || 'upstream request failed',
    });

    if (!generationCreated) {
      try {
        await sendRich(chatId, errorMessage('The bot could not initialize this response. The owner should deploy the latest schema and apply its additive database migration, then try again.'));
      } catch {}
      return;
    }

    const status = Number(error?.status);
    let messageText = 'I could not generate a response right now. Please try again shortly.';
    if (status === 401 || status === 403) {
      messageText = 'Sarvam rejected the configured API key. The bot owner can update it using /setkey YOUR_SARVAM_API_KEY.';
    } else if (status === 429) {
      messageText = 'Sarvam is receiving too many requests right now. Please wait a little and try again.';
    }

    try {
      const generation = await getGeneration(chatId, draftId);
      if (generation?.status === 'running') {
        const mayFinalize = await completeGeneration(chatId, draftId);
        if (mayFinalize) {
          await sendRich(chatId, errorMessage(messageText));
          if (userMessageSaved) await saveConversationAssistantMessage(userTgId, messageText);
        }
      } else if (generation?.status === 'completed') {
        await sendRich(chatId, errorMessage(messageText));
        if (userMessageSaved) await saveConversationAssistantMessage(userTgId, messageText);
      }
    } catch (sendError) {
      console.error('Could not send the AI error response:', {
        message: sendError?.description || sendError?.message || 'Telegram delivery failed',
      });
    }
  } finally {
    try {
      const generation = await getGeneration(chatId, draftId);
      // The stopped-message handler owns finalizing and deleting stopped rows.
      // Keeping the row avoids racing that separate Serverless invocation.
      if (generation?.status !== 'stopped') await deleteGeneration(chatId, draftId);
    } catch {}
  }
}
