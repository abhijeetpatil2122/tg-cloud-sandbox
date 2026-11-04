import { categories } from './config.js';

const plain = (text) => String(text ?? '');
const heading = (text, size = 2) => ({ type: 'heading', size, text: plain(text) });
const paragraph = (text) => ({ type: 'paragraph', text });
const footer = (text) => ({ type: 'footer', text: plain(text) });

export function buildReviewRichMessage(data, reviewNumber = null, preview = false) {
  const category = categories.find((item) => item.key === data.categoryKey);
  const blocks = [
    heading('MOVIE REVIEW', 2),
  ];
  const posterMedia = data.posterMedia || data.posterFileId || data.posterUrl;
  if (posterMedia) {
    blocks.push({
      type: 'photo',
      photo: { type: 'photo', media: posterMedia, ...(data.hasSpoilers ? { has_spoiler: true } : {}) },
    });
  }
  blocks.push(
    heading(`${plain(data.title)} (${plain(data.year)})`, 1),
    ...(data.genre ? [paragraph(plain(data.genre))] : []),
    paragraph([
      { type: 'button', button: { text: `★ ${plain(data.rating)}/10`, style: 'success', disabled: {} } },
      ...(data.hasSpoilers ? ['  ', { type: 'button', button: { text: 'SPOILER', style: 'danger', disabled: {} } }] : []),
    ]),
    { type: 'divider' },
    heading('Review', 3),
    {
      type: 'paragraph',
      text: data.hasSpoilers
        ? { type: 'spoiler', text: plain(data.reviewText) }
        : plain(data.reviewText),
    },
    { type: 'divider' },
    footer(`Reviewed by ${plain(data.authorName || 'Telegram user')}   •   ${preview ? 'Preview' : `Review #${String(reviewNumber).padStart(3, '0')}`}`),
  );
  return { blocks };
}

export function buildReviewKeyboard(data, mode = 'preview') {
  if (mode === 'preview') {
    return { inline_keyboard: [
      [{ text: 'Publish review', callback_data: 'rv:publish', style: 'success' }],
      [
        { text: 'Edit details', callback_data: 'rv:edit:menu' },
        { text: 'Cancel', callback_data: 'rv:cancel', style: 'danger' },
      ],
    ] };
  }
  const category = categories.find((item) => item.key === data.categoryKey);
  return { inline_keyboard: [
    [{ text: data.hasSpoilers ? 'SPOILER REVIEW' : `★ ${data.rating}/10`, callback_data: 'rv:noop', style: data.hasSpoilers ? 'danger' : 'success', disabled: true }],
    [
      { text: category?.label ?? 'Review', callback_data: 'rv:noop', style: 'primary', disabled: true },
      { text: String(data.year), callback_data: 'rv:noop', style: 'primary', disabled: true },
      ...(data.season ? [{ text: `Season ${data.season}`, callback_data: 'rv:noop', style: 'primary', disabled: true }] : []),
    ],
  ] };
}

export function buildEditKeyboard() {
  const fields = [
    ['title', 'Title'], ['year', 'Year'], ['genre', 'Genre'], ['season', 'Season'],
    ['rating', 'Rating'], ['text', 'Review text'], ['poster', 'Poster'], ['spoiler', 'Spoilers'],
  ];
  return { inline_keyboard: [
    ...fields.map(([key, label]) => [{ text: label, callback_data: `rv:edit:${key}` }]),
    [{ text: 'Back to preview', callback_data: 'rv:preview' }],
  ] };
}

export function buildHelpRichMessage() {
  return { blocks: [
    heading('ReviewTVBot', 1),
    paragraph('A community space for thoughtful movie, series, and anime reviews. Share your opinion, rate what you watched, and discover what others recommend.'),
    { type: 'divider' },
    heading('Commands', 3),
    { type: 'list', items: [
      { blocks: [paragraph('/start — Welcome message')] },
      { blocks: [paragraph('/help — View this help menu')] },
      { blocks: [paragraph('/howtouse — Step-by-step review guide')] },
      { blocks: [paragraph('/review — Write and submit a review')] },
      { blocks: [paragraph('/myreviews — View your published reviews')] },
      { blocks: [paragraph('/cancel — Cancel your active draft')] },
    ] },
    { type: 'divider' },
    footer('Need a hand? Use /howtouse to see how reviews are submitted.'),
  ] };
}

export function buildHowToRichMessage() {
  const sample = buildReviewRichMessage({
    categoryKey: 'hollywood_movies', title: 'Example Film', year: 2026,
    rating: 8, reviewText: 'A sample review appears here. Your own words will be shown in this section with their original paragraph breaks.',
    authorName: 'yourname', hasSpoilers: false,
  }, 1, true);
  return { blocks: [
    heading('HOW TO POST A REVIEW', 1),
    paragraph('Follow these simple steps. Your draft is saved as you go, and the review is not posted until you confirm it.'),
    { type: 'list', items: [
      { value: 1, type: '1', blocks: [paragraph('Send /review in your private chat with the bot.')] },
      { value: 2, type: '1', blocks: [paragraph('Choose the correct category: Hollywood, Bollywood, South Indian, other regional, TV shows, or anime.')] },
      { value: 3, type: '1', blocks: [paragraph('Enter the title and release year. TV show reviewers can add a season number or skip it.')] },
      { value: 4, type: '1', blocks: [paragraph('Optionally send the genre or genres (for example, Action, Drama, Romance), or skip this step.')] },
      { value: 5, type: '1', blocks: [paragraph('TV show reviewers can add a season number or skip it.')] },
      { value: 6, type: '1', blocks: [paragraph('Choose your rating from 1 to 10.')] },
      { value: 5, type: '1', blocks: [paragraph('Write your review in your own words. Explain what worked, what did not, and who might enjoy it. Avoid revealing major plot details unless you mark the review as a spoiler.')] },
      { value: 8, type: '1', blocks: [paragraph('Add a poster photo if you have one, or skip this step.')] },
      { value: 9, type: '1', blocks: [paragraph('Choose whether your review contains spoilers. Spoiler reviews hide the review text and poster preview.')] },
      { value: 10, type: '1', blocks: [paragraph('Check the preview. Use Edit details to change a field, then tap Publish review when everything looks right.')] },
    ] },
    { type: 'divider' },
    heading('PUBLISHED REVIEW PREVIEW', 2),
    ...sample.blocks,
    { type: 'divider' },
    footer('Tip: Be respectful, stay on topic, and write your own review. Use /review whenever you are ready.'),
  ] };
}
