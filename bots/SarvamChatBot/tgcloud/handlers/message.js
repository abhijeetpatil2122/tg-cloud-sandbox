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
  coding: { label: 'Writing and checking code…', emojis: ['💻', '⌨️', '🧑‍💻', '⚙️'] },
  debugging: { label: 'Investigating the issue…', emojis: ['🔧', '🛠️', '🐛', '🔍'] },
  writing: { label: 'Working on the draft…', emojis: ['✍️', '📝', '📄'] },
  research: { label: 'Researching the topic…', emojis: ['🔎', '🔍', '📚', '🌐'] },
  search: { label: 'Checking live sources…', emojis: ['🔎', '🔍', '🌐', '📰'] },
  analysis: { label: 'Analyzing the information…', emojis: ['📊', '📈', '🔬'] },
  math: { label: 'Working through the calculation…', emojis: ['🧮', '📐', '➗'] },
  design: { label: 'Working on the design…', emojis: ['🎨', '🖌️', '🖼️'] },
  translation: { label: 'Translating the text…', emojis: ['🌐', '🗣️', '📖'] },
  summary: { label: 'Preparing a concise summary…', emojis: ['📑', '📝', '📚'] },
  planning: { label: 'Planning the steps…', emojis: ['🗓️', '🧭', '📋'] },
  thinking: { label: 'Thinking…', emojis: ['🧠', '💭'] },
};

function detectThinkingAction(text) {
  const value = String(text || '').toLowerCase();

  // Prioritize explicit task intent over incidental keywords.
  if (/\b(debug|debugging|fix (?:this|the|my)|troubleshoot|stack trace|exception|bug|crash|not working|doesn.t work|error log)\b/.test(value)) return 'debugging';
  if (/\b(search|look up|find current|latest|today|right now|news|recent update|verify (?:this|the)|source|citation|official docs)\b/.test(value)) return 'search';
  if (/\b(code|coding|program|script|function|class|webhook|database|sql|javascript|typescript|python|html|css|react|deploy|implementation|implement|build (?:a|an|the)|write (?:the )?code)\b/.test(value)
    || /\b(create|make|develop|build|implement|write)\s+(?:me\s+)?(?:a|an|the)?\s*(?:telegram\s+)?(?:bot|website|web app|mobile app|api|script|program)\b/.test(value)
    || /\b(api|bot)\s+(?:integration|endpoint|webhook|implementation|code|development)\b/.test(value)) return 'coding';
  if (/\b(translate|translation|transliterate|in hindi|in marathi|in tamil|in bengali|in gujarati|in telugu|in kannada|in malayalam)\b/.test(value)) return 'translation';
  if (/\b(summarize|summarise|summary|tldr|key points|meeting notes|extract the main)\b/.test(value)) return 'summary';
  if (/\b(calculate|calculation|solve|equation|integral|derivative|algebra|geometry|probability|statistics|formula|math|mathematics)\b/.test(value)
    || /\d\s*[+*/^=-]\s*\d/.test(value)) return 'math';
  if (/\b(analy[sz]e|analysis|compare|comparison|evaluate|benchmark|pros and cons|review|interpret|trend|dataset|metrics)\b/.test(value)) return 'analysis';
  if (/\b(design|logo|mockup|wireframe|ui|ux|layout|visual|colour palette|color palette|branding|poster|banner|illustration|generate (?:an? )?image|create (?:an? )?image)\b/.test(value)) return 'design';
  if (/\b(plan|planning|roadmap|itinerary|schedule|organize|organise|strategy|steps to|timeline)\b/.test(value)) return 'planning';
  if (/\b(write|draft|rewrite|polish|proofread|email|post|article|story|document|proposal|caption|announcement|message)\b/.test(value)) return 'writing';
  if (/\b(research|investigate|deep dive|explain in detail|sources for|study)\b/.test(value)) return 'research';
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

function userFacingGenerationError(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  const code = String(error?.code || '').toLowerCase();

  if (status === 402 || code === 'insufficient_quota_error') {
    return 'The AI service has run out of available credits. The bot owner needs to add credits to the provider account before requests can continue.';
  }
  if (status === 403 || code === 'invalid_api_key_error') {
    return 'The AI service rejected its configured key. The bot owner should check the saved API key.';
  }
  if (status === 429 && code === 'seat_budget_exhausted_error') {
    return 'The AI service account has reached its spending limit. The account owner needs to review its usage budget.';
  }
  if (status === 429 || status === 503 || code === 'rate_limit_exceeded_error'
    || code === 'model_rate_limit_exceeded_error' || code === 'model_overloaded') {
    return 'The AI service is busy or has reached its request limit. Please wait briefly and send your message again.';
  }
  if (status === 400 || status === 413 || status === 422 || code === 'invalid_request_error') {
    return 'The request could not be processed because its content or size was not accepted. Try shortening the message or splitting it into smaller parts.';
  }
  if (status === 404 || code === 'not_found_error') {
    return 'The configured AI model or endpoint could not be found. The bot owner needs to check the model configuration.';
  }
  if (status === 500 || status === 502 || status === 504 || code === 'internal_server_error'
    || code === 'model_call_failed') {
    return 'The AI provider encountered a temporary service problem. Please wait briefly and try again.';
  }
  if (code === 'invalid_sse_event' || code === 'stream_error') {
    return 'The AI response stream was interrupted unexpectedly. Please send “continue” to resume if a partial answer was saved, or retry your question.';
  }
  if (status === 0) {
    return 'The AI service could not be reached. Check the connection or try again shortly.';
  }
  return 'I could not complete that response. Please try again shortly.';
}

function plainTextFallback(value) {
  return String(value || '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1 ($2)')
    .replace(/\*\*(.*?)\*\*/gs, '$1')
    .replace(/(?<!\*)\*(?!\*)(.*?)\*(?!\*)/gs, '$1')
    .replace(/~~(.*?)~~/gs, '$1')
    .replace(/==(.*?)==/gs, '$1')
    .replace(/\|\|(.*?)\|\|/gs, '$1')
    .replace(/`{1,3}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, '')
    .replace(/^\s*\|/gm, '')
    .replace(/\|\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function deliverFinal(chatId, answer) {
  try {
    await sendRich(chatId, { markdown: answer });
    return;
  } catch (markdownError) {
    console.warn('Rich Markdown final delivery failed; retrying as Rich HTML:', {
      message: markdownError?.description || markdownError?.message || 'Markdown rejected',
    });
  }

  try {
    await sendRich(chatId, { html: answer });
    return;
  } catch (htmlError) {
    console.warn('Rich HTML final delivery failed; sending a plain-text Rich Message:', {
      message: htmlError?.description || htmlError?.message || 'HTML rejected',
    });
  }

  await sendRich(chatId, {
    blocks: [{ type: 'paragraph', text: plainTextFallback(answer) }],
  });
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
          const searchStatus = Number(error?.status);
          const searchCode = String(error?.code || '');
          result = {
            error: searchStatus === 402 || searchCode === 'insufficient_quota_error'
              ? 'The search provider has no available credits. Tell the user live verification is unavailable until the owner tops up the search account.'
              : searchStatus === 403
                ? 'The search provider rejected its configured key. Tell the user live verification is temporarily unavailable and the owner may need to check the search key.'
                : searchStatus === 429 || searchStatus === 503
                  ? 'The search provider is rate-limiting or temporarily overloaded. Do not invent current facts; explain that live verification could not be completed.'
                  : 'The search provider returned an error. Do not invent current facts; explain that live verification could not be completed.',
            provider_status: searchStatus || null,
            provider_code: searchCode || null,
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
    console.error('AI response failed:', {
      status: error?.status || error?.statusCode || null,
      code: error?.code || null,
      requestId: error?.requestId || null,
      message: error?.description || error?.message || 'upstream request failed',
    });

    if (!generationCreated) {
      try {
        await sendRich(chatId, errorMessage('The bot could not initialize this response. The owner should deploy the latest schema and apply its additive database migration, then try again.'));
      } catch {}
      return;
    }

    const messageText = userFacingGenerationError(error);

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
