import { api } from 'sdk';
import { getDraft, saveDraft, deleteDraft } from '../lib/sessions.js';
import {
  sendCategoryPicker, askTitle, askYear, askSeason, askRating, askReviewText,
  askPoster, askSpoilers, sendDraftComplete,
} from '../lib/review-flow.js';
import {
  connectForum, setCategoryTopic, showSettings, disconnectForum,
} from '../lib/forum.js';

function parseCommand(text) {
  const [rawCommand, ...args] = text.trim().split(/\s+/);
  return { command: rawCommand.split('@', 1)[0].toLowerCase(), args };
}

async function startReview(message) {
  if (message.chat.type !== 'private' || !message.from?.id) {
    await api.sendMessage({ chat_id: message.chat.id, text: 'Please start your review in a private chat with @ReviewTvBot.' });
    return;
  }
  const existing = await getDraft(message.from.id);
  if (existing) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: 'You already have an active review draft. I have resumed it at your last saved step.',
    });
    const prompts = {
      title: askTitle,
      year: askYear,
      season: askSeason,
      rating: askRating,
      review_text: askReviewText,
      poster: askPoster,
      spoiler: askSpoilers,
    };
    if (prompts[existing.step]) await prompts[existing.step](message.chat.id);
    else if (existing.step === 'complete') await sendDraftComplete(message.chat.id, existing.data);
    return;
  }
  await sendCategoryPicker(message.chat.id);
}

async function handleDraftInput(message, draft) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = typeof message.text === 'string' ? message.text.trim() : '';
  const data = { ...draft.data };

  if (draft.step === 'title') {
    if (text.length < 2 || text.length > 160) {
      await api.sendMessage({ chat_id: chatId, text: 'Please send a title between 2 and 160 characters.' });
      return;
    }
    data.title = text;
    await saveDraft(userId, chatId, 'year', data);
    await askYear(chatId);
    return;
  }

  if (draft.step === 'year') {
    const year = Number(text);
    const maxYear = new Date().getUTCFullYear() + 5;
    if (!/^\d{4}$/.test(text) || !Number.isInteger(year) || year < 1888 || year > maxYear) {
      await api.sendMessage({ chat_id: chatId, text: `Please send a valid four-digit year between 1888 and ${maxYear}.` });
      return;
    }
    data.year = year;
    if (data.categoryKey === 'tv_shows') {
      await saveDraft(userId, chatId, 'season', data);
      await askSeason(chatId);
    } else {
      await saveDraft(userId, chatId, 'rating', data);
      await askRating(chatId);
    }
    return;
  }

  if (draft.step === 'season') {
    if (text.toLowerCase() === '/skip') data.season = null;
    else {
      const season = Number(text);
      if (!/^\d{1,2}$/.test(text) || !Number.isInteger(season) || season < 1 || season > 99) {
        await api.sendMessage({ chat_id: chatId, text: 'Send a season number from 1 to 99, or tap Skip season.' });
        return;
      }
      data.season = season;
    }
    await saveDraft(userId, chatId, 'rating', data);
    await askRating(chatId);
    return;
  }

  if (draft.step === 'review_text') {
    if (text.length < 20 || text.length > 3000) {
      await api.sendMessage({ chat_id: chatId, text: 'Please write between 20 and 3000 characters for your review.' });
      return;
    }
    data.reviewText = text;
    await saveDraft(userId, chatId, 'poster', data);
    await askPoster(chatId);
    return;
  }

  if (draft.step === 'poster') {
    if (Array.isArray(message.photo) && message.photo.length > 0) {
      data.posterFileId = message.photo[message.photo.length - 1].file_id;
    } else if (text.toLowerCase() === '/skip') data.posterFileId = null;
    else {
      await api.sendMessage({ chat_id: chatId, text: 'Please send a photo as the poster, or tap Skip poster.' });
      return;
    }
    await saveDraft(userId, chatId, 'spoiler', data);
    await askSpoilers(chatId);
    return;
  }

  if (draft.step === 'complete') {
    await api.sendMessage({ chat_id: chatId, text: 'Your draft is complete. Preview and publishing will be available in the next phase. Use /cancel to discard it.' });
  }
}

export default async function (message) {
  if (!message?.chat?.id) return;
  const text = typeof message.text === 'string' ? message.text : '';

  try {
    if (text.startsWith('/')) {
      const { command, args } = parseCommand(text);
      if (command === '/connect') return await connectForum(message);
      if (command === '/settopic') return await setCategoryTopic(message, args[0] ?? '');
      if (command === '/settings') return await showSettings(message);
      if (command === '/disconnect') return await disconnectForum(message, args[0]);
      if (command === '/start') {
        await api.sendMessage({
          chat_id: message.chat.id,
          text: 'Welcome to ReviewTVBot.\n\nUse /review to submit a movie, TV show, or anime review. Your draft is saved as you go, and nothing is published without your final confirmation.',
        });
        return;
      }
      if (command === '/review') return await startReview(message);
      if (command === '/cancel') {
        if (message.chat.type !== 'private' || !message.from?.id) return;
        const draft = await getDraft(message.from.id);
        if (!draft) {
          await api.sendMessage({ chat_id: message.chat.id, text: 'You do not have an active review draft.' });
          return;
        }
        await deleteDraft(message.from.id);
        await api.sendMessage({ chat_id: message.chat.id, text: 'Your review draft has been discarded. Send /review to start again.' });
        return;
      }
      if (command === '/myreviews') {
        await api.sendMessage({ chat_id: message.chat.id, text: 'Your published review history will be available in a later phase.' });
        return;
      }
      if (command === '/help') {
        await api.sendMessage({
          chat_id: message.chat.id,
          text: [
            'ReviewTVBot help', '',
            'Member commands:',
            '/review — start a review in private chat',
            '/cancel — discard your active draft',
            '/myreviews — view published reviews (coming later)', '',
            'Forum owner commands:',
            '/connect — connect this forum (run as the group creator)',
            '/settopic category_key — map the current topic to a category',
            '/settings — show the topic mapping status',
            '/disconnect confirm — disable forum publishing',
          ].join('\n'),
        });
        return;
      }
      if (command !== '/skip') return;
    }

    if (message.chat.type !== 'private' || !message.from?.id) return;
    const draft = await getDraft(message.from.id);
    if (draft && draft.chatId === message.chat.id) await handleDraftInput(message, draft);
  } catch (error) {
    console.error('ReviewTVBot message handler failed', error);
    try {
      await api.sendMessage({
        chat_id: message.chat.id,
        text: 'Sorry, that action could not be completed. Please try again. If the problem continues, contact the bot owner.',
      });
    } catch (sendError) {
      console.error('ReviewTVBot could not send its fallback error message', sendError);
    }
  }
}
