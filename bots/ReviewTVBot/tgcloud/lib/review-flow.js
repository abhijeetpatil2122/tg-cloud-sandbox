import { api } from 'sdk';
import { categories } from './config.js';

async function send(chatId, text, replyMarkup) {
  const params = { chat_id: chatId, text };
  if (replyMarkup) params.reply_markup = replyMarkup;
  return api.sendMessage(params);
}

export async function sendCategoryPicker(chatId) {
  const rows = [];
  for (let i = 0; i < categories.length; i += 2) {
    rows.push(categories.slice(i, i + 2).map((category) => ({
      text: category.label,
      callback_data: `review:category:${category.key}`,
    })));
  }
  return send(chatId, 'Choose the category for your review:', { inline_keyboard: rows });
}

export async function askTitle(chatId) {
  return send(chatId, 'Send the movie, show, or anime title.');
}

export async function askYear(chatId) {
  return send(chatId, 'Send the release year (for example, 2024).');
}

export async function askSeason(chatId) {
  return send(chatId, 'Send the season number, or skip this field.', {
    inline_keyboard: [[{ text: 'Skip season', callback_data: 'review:season:skip' }]],
  });
}

export async function askRating(chatId) {
  const rows = [
    [1, 2, 3, 4, 5].map((rating) => ({ text: String(rating), callback_data: `review:rating:${rating}` })),
    [6, 7, 8, 9, 10].map((rating) => ({ text: String(rating), callback_data: `review:rating:${rating}` })),
  ];
  return send(chatId, 'Choose your rating out of 10:', { inline_keyboard: rows });
}

export async function askReviewText(chatId) {
  return send(chatId, 'Write your review (20–3000 characters).');
}

export async function askPoster(chatId) {
  return send(chatId, 'You can now send a poster photo, or skip this step.', {
    inline_keyboard: [[{ text: 'Skip poster', callback_data: 'review:poster:skip' }]],
  });
}

export async function askSpoilers(chatId) {
  return send(chatId, 'Does your review contain spoilers?', {
    inline_keyboard: [[
      { text: 'Yes, contains spoilers', callback_data: 'review:spoiler:yes' },
      { text: 'No spoilers', callback_data: 'review:spoiler:no' },
    ]],
  });
}

export async function sendDraftComplete(chatId, data) {
  const category = categories.find((item) => item.key === data.categoryKey);
  const lines = [
    'Your review details have been saved.',
    '',
    `${data.title} (${data.year})`,
    `Category: ${category?.label ?? data.categoryKey}`,
    `Rating: ${data.rating}/10`,
    data.season ? `Season: ${data.season}` : null,
    `Poster: ${data.posterFileId ? 'Added' : 'Not added'}`,
    `Spoilers: ${data.hasSpoilers ? 'Yes' : 'No'}`,
    '',
    'The draft is saved. Preview, editing, and publishing confirmation are the next development phase.',
    'Use /cancel if you want to discard this draft.',
  ].filter(Boolean);
  return send(chatId, lines.join('\n'));
}
