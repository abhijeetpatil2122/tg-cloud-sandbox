import { api, db } from 'sdk';
import { and, eq } from 'sdk/db';
import { reviewDrafts } from '../schema.js';
import { getDraft, saveDraft, deleteDraft } from '../lib/sessions.js';
import { categories, getCategory } from '../lib/config.js';
import { buildReviewRichMessage, buildReviewKeyboard, buildEditKeyboard, buildHowToRichMessage } from '../lib/formatting.js';
import { publishReview } from '../lib/publishing.js';

async function answer(id, text) {
  const params = { callback_query_id: id };
  if (text) params.text = text;
  await api.answerCallbackQuery(params);
}

function withBack(keyboard = null) {
  const rows = keyboard?.inline_keyboard ? keyboard.inline_keyboard.map(row => [...row]) : [];
  rows.push([
    { text: '‹ Back', callback_data: 'rv:back' },
    { text: 'Cancel review', callback_data: 'rv:cancel', style: 'danger' },
  ]);
  return { inline_keyboard: rows };
}

function categoryKeyboard() {
  const rows = [];
  for (let i = 0; i < categories.length; i += 2) {
    rows.push(categories.slice(i, i + 2).map(item => ({
      text: item.label, callback_data: `rv:category:${item.key}`,
    })));
  }
  rows.push([{ text: 'Cancel review', callback_data: 'rv:cancel', style: 'danger' }]);
  return { inline_keyboard: rows };
}

function ratingKeyboard() {
  return { inline_keyboard: [
    [1, 2, 3, 4, 5].map(n => ({ text: String(n), callback_data: `rv:rating:${n}` })),
    [6, 7, 8, 9, 10].map(n => ({ text: String(n), callback_data: `rv:rating:${n}` })),
  ] };
}

function spoilerKeyboard() {
  return { inline_keyboard: [[
    { text: 'Contains spoilers', callback_data: 'rv:spoiler:yes', style: 'danger' },
    { text: 'No spoilers', callback_data: 'rv:spoiler:no', style: 'success' },
  ]] };
}

async function editPrompt(chatId, messageId, text, replyMarkup = null) {
  return api.editMessageText({
    chat_id: chatId,
    message_id: messageId,
    text,
    reply_markup: replyMarkup || { inline_keyboard: [] },
  });
}

async function preview(chatId, draft) {
  return api.editMessageText({
    chat_id: chatId,
    message_id: draft.data.promptMessageId,
    rich_message: buildReviewRichMessage(draft.data, null, true),
    reply_markup: buildReviewKeyboard(draft.data, 'preview'),
  });
}

function errorForUser(error) {
  const raw = String(error?.description || error?.message || error || '').replace(/\s+/g, ' ').trim();
  if (/not connected|publishing topic|category/i.test(raw)) return 'This category is not connected to a publishing topic yet. Please contact the bot administrator.';
  if (/not enough rights|administrator|chat not found|thread|topic/i.test(raw)) return 'The bot cannot post to the selected community topic. Please ask an administrator to check its forum permissions and topic mapping.';
  if (/photo|file|media|wrong file/i.test(raw)) return 'Telegram could not use that poster. Edit the poster and try a Telegram photo or a public direct HTTPS image link.';
  if (/database|SQLITE|constraint|no such table/i.test(raw)) return 'The review database is not ready for publishing. Please contact the bot administrator.';
  return 'Telegram could not publish this review right now.';
}

export default async function (query) {
  if (!query?.id) return;
  const chat = query.message?.chat;
  const userId = query.from?.id;
  try {
    if (!chat || chat.type !== 'private' || !userId || chat.id !== userId) {
      await answer(query.id, 'Please use these buttons in your private chat with the bot.');
      return;
    }

    const [prefix, action, value] = String(query.data ?? '').split(':');
    if (prefix !== 'rv') {
      await answer(query.id, 'This button is not recognized.');
      return;
    }
    if (action === 'howto') {
      await answer(query.id);
      await api.editMessageText({
        chat_id: chat.id,
        message_id: query.message.message_id,
        rich_message: buildHowToRichMessage(),
        reply_markup: { inline_keyboard: [[{ text: 'Write a review', callback_data: 'rv:start', style: 'success' }]] },
      });
      return;
    }
    if (action === 'noop') {
      await answer(query.id);
      return;
    }

    const draft = await getDraft(userId);
    if (action === 'start') {
      if (draft && draft.step !== 'complete') {
        await answer(query.id, 'You already have a review in progress. Resume it with /review or cancel it first.');
        return;
      }
      if (draft?.step === 'complete') {
        await answer(query.id, 'You already have a completed draft. Opening its preview.');
        return preview(chat.id, draft);
      }
      await answer(query.id);
      await saveDraft(userId, chat.id, 'category', { promptMessageId: query.message.message_id });
      await editPrompt(chat.id, query.message.message_id, 'Choose the category for your review:', categoryKeyboard());
      return;
    }

    if (action === 'category') {
      if (draft && draft.step !== 'category') {
        await answer(query.id, 'You already have an active review. Resume it with /review or cancel it first.');
        return;
      }
      const category = getCategory(value);
      if (!category) {
        await answer(query.id, 'Unknown category.');
        return;
      }
      const data = {
        ...(draft?.data ?? {}),
        categoryKey: category.key,
        promptMessageId: query.message.message_id,
        authorName: [query.from.first_name, query.from.last_name].filter(Boolean).join(' ') || 'Telegram user',
      };
      await saveDraft(userId, chat.id, 'title', data);
      await answer(query.id);
      await editPrompt(chat.id, data.promptMessageId, 'Send the movie, show, or anime title.', withBack());
      return;
    }

    if (!draft || draft.chatId !== chat.id) {
      await answer(query.id, 'This review session has expired. Send /review to start again.');
      return;
    }
    const data = { ...draft.data };

    if (action === 'back') {
      await answer(query.id);
      if (draft.step.startsWith('edit_')) return preview(chat.id, { ...draft, step: 'complete' });
      const previous = {
        title: ['category', 'Choose the category for your review:', categoryKeyboard()],
        year: ['title', 'Send the movie, show, or anime title.', null],
        genre: ['year', 'Send the release year (for example, 2024).', null],
        season: ['genre', 'Optionally send the genre or genres, or tap Skip genre.', { inline_keyboard: [[{ text: 'Skip genre', callback_data: 'rv:genre:skip' }]] }],
        rating: data.categoryKey === 'tv_shows'
          ? ['season', 'Send the season number, or tap Skip season.', { inline_keyboard: [[{ text: 'Skip season', callback_data: 'rv:season:skip' }]] }]
          : ['genre', 'Optionally send the genre or genres, or tap Skip genre.', { inline_keyboard: [[{ text: 'Skip genre', callback_data: 'rv:genre:skip' }]] }],
        review_text: ['rating', 'Choose your rating from 1 to 10.', ratingKeyboard()],
        poster: ['review_text', 'Write your review in 20–3000 characters.', null],
        spoiler: ['poster', 'Send a poster photo, a direct HTTPS image link, or skip this step.', { inline_keyboard: [[{ text: 'Skip poster', callback_data: 'rv:poster:skip' }]] }],
      }[draft.step];
      if (!previous) return preview(chat.id, { ...draft, step: 'complete' });
      await saveDraft(userId, chat.id, previous[0], data);
      return editPrompt(chat.id, data.promptMessageId, previous[1], withBack(previous[2]));
    }

    if (action === 'genre' && value === 'skip' && ['genre', 'edit_genre'].includes(draft.step)) {
      data.genre = null;
      await answer(query.id);
      if (draft.step === 'edit_genre') {
        await saveDraft(userId, chat.id, 'complete', data);
        return preview(chat.id, await getDraft(userId));
      }
      if (data.categoryKey === 'tv_shows') {
        await saveDraft(userId, chat.id, 'season', data);
        return editPrompt(chat.id, data.promptMessageId, 'Send the season number, or tap Skip season.', withBack({ inline_keyboard: [[{ text: 'Skip season', callback_data: 'rv:season:skip' }]] }));
      }
      await saveDraft(userId, chat.id, 'rating', data);
      return editPrompt(chat.id, data.promptMessageId, 'Choose your rating from 1 to 10.', withBack(ratingKeyboard()));
    }

    if (action === 'season' && value === 'skip' && ['season', 'edit_season'].includes(draft.step)) {
      data.season = null;
      await answer(query.id);
      if (draft.step === 'edit_season') {
        await saveDraft(userId, chat.id, 'complete', data);
        return preview(chat.id, await getDraft(userId));
      }
      await saveDraft(userId, chat.id, 'rating', data);
      return editPrompt(chat.id, data.promptMessageId, 'Choose your rating from 1 to 10.', withBack(ratingKeyboard()));
    }

    if (action === 'rating' && ['rating', 'edit_rating'].includes(draft.step)) {
      const rating = Number(value);
      if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
        await answer(query.id, 'Choose a rating from 1 to 10.');
        return;
      }
      data.rating = rating;
      await answer(query.id);
      if (draft.step === 'edit_rating') {
        await saveDraft(userId, chat.id, 'complete', data);
        return preview(chat.id, await getDraft(userId));
      }
      await saveDraft(userId, chat.id, 'review_text', data);
      return editPrompt(chat.id, data.promptMessageId, 'Write your review in 20–3000 characters.', withBack());
    }

    if (action === 'poster' && value === 'skip' && ['poster', 'edit_poster'].includes(draft.step)) {
      data.posterFileId = null;
      data.posterUrl = null;
      await answer(query.id);
      if (draft.step === 'edit_poster') {
        await saveDraft(userId, chat.id, 'complete', data);
        return preview(chat.id, await getDraft(userId));
      }
      await saveDraft(userId, chat.id, 'spoiler', data);
      return editPrompt(chat.id, data.promptMessageId, 'Does your review contain spoilers?', withBack(spoilerKeyboard()));
    }

    if (action === 'spoiler' && ['spoiler', 'edit_spoiler'].includes(draft.step) && ['yes', 'no'].includes(value)) {
      data.hasSpoilers = value === 'yes';
      await saveDraft(userId, chat.id, 'complete', data);
      await answer(query.id);
      return preview(chat.id, await getDraft(userId));
    }

    if (action === 'edit' && draft.step === 'complete') {
      if (value === 'menu') {
        await answer(query.id);
        await saveDraft(userId, chat.id, 'complete', data);
        return editPrompt(chat.id, data.promptMessageId, 'Choose the field you want to edit:', buildEditKeyboard());
      }
      const steps = {
        title: ['edit_title', 'Send the corrected title.'],
        year: ['edit_year', 'Send the corrected release year.'],
        genre: ['edit_genre', 'Send genre names, or tap Skip genre to remove them.'],
        season: ['edit_season', 'Send a season number, or tap Skip season.'],
        rating: ['edit_rating', 'Choose the corrected rating.'],
        text: ['edit_text', 'Send the corrected review text.'],
        poster: ['edit_poster', 'Send a new poster photo or a direct HTTPS image link, or skip.'],
        spoiler: ['edit_spoiler', 'Choose the spoiler setting.'],
      };
      const selected = steps[value];
      if (!selected) {
        await answer(query.id, 'Unknown field.');
        return;
      }
      await saveDraft(userId, chat.id, selected[0], data);
      await answer(query.id);
      const keyboard = value === 'rating' ? ratingKeyboard()
        : value === 'genre' ? { inline_keyboard: [[{ text: 'Skip genre', callback_data: 'rv:genre:skip' }]] }
        : value === 'poster' ? { inline_keyboard: [[{ text: 'Remove poster', callback_data: 'rv:poster:skip' }]] }
        : value === 'spoiler' ? spoilerKeyboard()
        : value === 'season' ? { inline_keyboard: [[{ text: 'Skip season', callback_data: 'rv:season:skip' }]] }
        : null;
      return editPrompt(chat.id, data.promptMessageId, selected[1], withBack(keyboard));
    }

    if (action === 'preview' && draft.step === 'complete') {
      await answer(query.id);
      return preview(chat.id, draft);
    }

    if (action === 'cancel') {
      await deleteDraft(userId);
      await answer(query.id, 'Draft cancelled.');
      return editPrompt(chat.id, data.promptMessageId, 'Your review draft has been cancelled.');
    }

    if (action === 'publish' && draft.step === 'complete') {
      const claim = await db.update(reviewDrafts).set({ step: 'publishing', updatedAt: new Date() })
        .where(and(eq(reviewDrafts.userId, userId), eq(reviewDrafts.step, 'complete'))).run();
      if (!claim.rowsAffected) {
        await answer(query.id, 'This review is already being processed.');
        return;
      }
      await answer(query.id, 'Publishing your review…');
      try {
        const result = await publishReview(userId, { ...draft, step: 'complete', data });
        await deleteDraft(userId);
        await api.editMessageText({
          chat_id: chat.id,
          message_id: data.promptMessageId,
          rich_message: { blocks: [
            { type: 'heading', size: 2, text: '✅ Review posted!' },
            { type: 'paragraph', text: `Your review is now live in ${result.category.label}.` },
            { type: 'paragraph', text: { type: 'url', text: 'Open your published review', url: result.link } },
            { type: 'footer', text: `Review #${String(result.reviewNumber).padStart(3, '0')}` },
          ] },
          reply_markup: { inline_keyboard: [] },
        });
      } catch (error) {
        console.error('Review publishing failed', {
          message: error?.message,
          description: error?.description,
          error_code: error?.error_code,
          stack: error?.stack,
        });
        await saveDraft(userId, chat.id, 'complete', data);
        await editPrompt(chat.id, data.promptMessageId,
          `I couldn't publish this review: ${errorForUser(error)} Your draft is saved; you can retry or edit it.`,
          buildReviewKeyboard(data, 'preview'));
      }
      return;
    }

    await answer(query.id, 'This button is no longer active.');
  } catch (error) {
    console.error('ReviewTVBot callback handler failed', error);
    try {
      await answer(query.id, 'Something went wrong. Your saved draft is safe.');
    } catch (answerError) {
      console.error('Callback acknowledgement failed', answerError);
    }
  }
}
