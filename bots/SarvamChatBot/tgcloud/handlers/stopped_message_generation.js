import { api } from 'sdk';
import {
  deleteGeneration,
  saveConversationAssistantMessage,
  stopGeneration,
} from '../lib/conversation.js';

export default async function (payload) {
  const stopped = payload?.stopped_message_generation || payload;
  const chatId = stopped?.chat?.id;
  const draftId = stopped?.draft_id;
  if (!chatId || !draftId) return;

  try {
    const generation = await stopGeneration(chatId, draftId);
    if (generation?.status !== 'stopped') return;

    const partial = typeof generation.partialText === 'string' ? generation.partialText.trim() : '';
    const richMessage = partial
      ? { markdown: partial }
      : { blocks: [{ type: 'paragraph', text: 'Generation stopped.' }] };

    try {
      await api.sendRichMessage({ chat_id: chatId, rich_message: richMessage });
    } catch (markdownError) {
      console.warn('Stopped draft Markdown could not be finalized; retrying as Rich HTML:', {
        message: markdownError?.description || markdownError?.message || 'Rich Markdown rejected',
      });
      try {
        await api.sendRichMessage({
          chat_id: chatId,
          rich_message: { html: partial || '<p>Generation stopped.</p>' },
        });
      } catch (htmlError) {
        console.warn('Stopped draft Rich HTML also failed; sending plain text:', {
          message: htmlError?.description || htmlError?.message || 'Rich HTML rejected',
        });
        await api.sendRichMessage({
          chat_id: chatId,
          rich_message: {
            blocks: [{ type: 'paragraph', text: (partial || 'Generation stopped.').replace(/<[^>]+>/g, '') }],
          },
        });
      }
    }

    // sendRichMessage creates the permanent chat message. Telegram then removes
    // the temporary draft preview; keep_on_stop alone cannot make it permanent.
    if (generation.userTgId) {
      try {
        await saveConversationAssistantMessage(
          generation.userTgId,
          partial || 'Generation stopped.',
        );
      } catch (historyError) {
        console.warn('Stopped answer was sent but could not be saved to conversation history:', {
          message: historyError?.description || historyError?.message || 'history write failed',
        });
      }
    }
    await deleteGeneration(chatId, draftId);
  } catch (error) {
    console.error('Could not finalize stopped generation:', {
      message: error?.description || error?.message || 'stop handling failed',
    });
  }
}
