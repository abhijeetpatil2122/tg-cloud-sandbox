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
    await api.sendRichMessage({
      chat_id: chatId,
      rich_message: partial
        ? { markdown: partial }
        : { blocks: [{ type: 'paragraph', text: 'Generation stopped.' }] },
    });
    await deleteGeneration(chatId, draftId);
  } catch (error) {
    console.error('Could not finalize stopped generation:', {
      message: error?.description || error?.message || 'stop handling failed',
    });
  }
}
