import { api } from 'sdk';
import { getDraft, saveDraft } from '../lib/sessions.js';
import { getCategory } from '../lib/config.js';
import {
  askTitle, askRating, askReviewText, askSpoilers, sendDraftComplete,
} from '../lib/review-flow.js';

async function answer(callbackQueryId, text) {
  const params = { callback_query_id: callbackQueryId };
  if (text) params.text = text;
  await api.answerCallbackQuery(params);
}

export default async function (query) {
  if (!query?.id) return;
  const chat = query.message?.chat;
  const userId = query.from?.id;

  try {
    if (!chat || chat.type !== 'private' || !userId || chat.id !== userId) {
      await answer(query.id, 'Please use the buttons in your private chat with the bot.');
      return;
    }

    const parts = String(query.data ?? '').split(':');
    if (parts[0] !== 'review' || parts.length !== 3) {
      await answer(query.id, 'This button is not recognized.');
      return;
    }

    const [, action, value] = parts;
    const draft = await getDraft(userId);

    if (action === 'category') {
      if (draft) {
        await answer(query.id, 'You already have an active draft.');
        return;
      }
      const category = getCategory(value);
      if (!category) {
        await answer(query.id, 'Unknown review category.');
        return;
      }
      await saveDraft(userId, chat.id, 'title', { categoryKey: category.key });
      await answer(query.id);
      await askTitle(chat.id);
      return;
    }

    if (!draft || draft.chatId !== chat.id) {
      await answer(query.id, 'This review session is no longer active. Send /review to start again.');
      return;
    }

    const data = { ...draft.data };
    if (action === 'season' && value === 'skip' && draft.step === 'season') {
      data.season = null;
      await saveDraft(userId, chat.id, 'rating', data);
      await answer(query.id);
      await askRating(chat.id);
      return;
    }

    if (action === 'rating' && draft.step === 'rating') {
      const rating = Number(value);
      if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
        await answer(query.id, 'Choose a rating from 1 to 10.');
        return;
      }
      data.rating = rating;
      await saveDraft(userId, chat.id, 'review_text', data);
      await answer(query.id);
      await askReviewText(chat.id);
      return;
    }

    if (action === 'poster' && value === 'skip' && draft.step === 'poster') {
      data.posterFileId = null;
      await saveDraft(userId, chat.id, 'spoiler', data);
      await answer(query.id);
      await askSpoilers(chat.id);
      return;
    }

    if (action === 'spoiler' && draft.step === 'spoiler' && (value === 'yes' || value === 'no')) {
      data.hasSpoilers = value === 'yes';
      await saveDraft(userId, chat.id, 'complete', data);
      await answer(query.id, 'Draft saved.');
      await sendDraftComplete(chat.id, data);
      return;
    }

    await answer(query.id, 'This button is no longer active.');
  } catch (error) {
    console.error('ReviewTVBot callback handler failed', error);
    try {
      await answer(query.id, 'Something went wrong. Please try again.');
    } catch (answerError) {
      console.error('ReviewTVBot could not answer callback query', answerError);
    }
  }
}
