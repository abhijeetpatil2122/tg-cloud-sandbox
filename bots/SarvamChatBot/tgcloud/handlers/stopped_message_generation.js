import { api } from 'sdk';
import { deleteGeneration, stopGeneration } from '../lib/conversation.js';

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
    } catch (sendError) {
      console.warn('Stopped draft Markdown could not be finalized; retrying as plain Rich Message:', {
        message: sendError?.description || sendError?.message || 'Rich Markdown rejected',
      });
      await api.sendRichMessage({
        chat_id: chatId,
        rich_message: {
          blocks: [{ type: 'paragraph', text: partial || 'Generation stopped.' }],
        },
      });
    }

    // sendRichMessage creates the permanent chat message. Telegram then removes
    // the temporary draft preview; keep_on_stop alone cannot make it permanent.
    await deleteGeneration(chatId, draftId);
  } catch (error) {
    console.error('Could not finalize stopped generation:', {
      message: error?.description || error?.message || 'stop handling failed',
    });
  }
}
