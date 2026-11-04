import { categories } from './config.js';

const plain = (text) => String(text ?? '');
const heading = (text, size = 2) => ({ type: 'heading', size, text: plain(text) });
const paragraph = (text) => ({ type: 'paragraph', text });
const footer = (text) => ({ type: 'footer', text: plain(text) });

export function buildReviewRichMessage(data, reviewNumber = null, preview = false) {
  const blocks = [
    heading(data.categoryKey === 'tv_shows' ? 'SERIES REVIEW' : 'MOVIE REVIEW', 2),
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
    ...(data.categoryKey === 'tv_shows' && data.season ? [paragraph(`Season ${plain(data.season)}`)] : []),
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

export function buildHelpRichMessage(isAdmin = false) {
  return { blocks: [
    heading('HELP & COMMANDS', 1),
    paragraph('Submit thoughtful reviews of movies, series, and anime. Every published review is organised in the appropriate topic of @Review_Tv.'),
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
    ...(isAdmin ? [
      heading('Private administration', 3),
      paragraph(['/admin', ' — Open the private admin panel and access administration commands.']),

    ] : []),
    { type: 'footer', text: ['Reviews are published in ', { type: 'url', text: '@Review_Tv', url: 'https://t.me/Review_Tv' }, '. Use /howtouse for the submission guide.'] },
  ] };
}

export function buildHowToRichMessage() {
  const sample = buildReviewRichMessage({
    categoryKey: 'tv_shows',
    title: 'Game of Thrones',
    year: 2011,
    genre: 'Fantasy, Drama',
    season: 8,
    rating: 9,
    reviewText: 'An ambitious fantasy series with unforgettable characters, political intrigue, and remarkable world-building. Its strongest seasons build tension through layered storytelling and memorable performances. A landmark series for viewers who enjoy complex dramas and large-scale fantasy.',
    authorName: 'yourname',
    hasSpoilers: false,
  }, 1, false);
  return { blocks: [
    heading('HOW TO POST A REVIEW', 1),
    paragraph('Posting is simple. Start a review and follow the prompts — your draft is saved as you go, and nothing is published until you confirm it.'),
    { type: 'list', items: [
      { value: 1, type: '1', blocks: [paragraph('Send /review in your private chat and choose the review category.')] },
      { value: 2, type: '1', blocks: [paragraph('Enter the title and release year. Add a genre if you want; series reviews can also include a season number.')] },
      { value: 3, type: '1', blocks: [paragraph('Choose a rating from 1–10, then write your review in your own words.')] },
      { value: 4, type: '1', blocks: [paragraph('Add a poster or skip it, choose the spoiler setting, check your preview, and tap Publish review.')] },
    ] },
    { type: 'details', summary: 'See an example of a published series review', blocks: sample.blocks },
  ] };
}

export function buildMyReviewsRichMessage(items, page, pageCount, total) {
  const listItems = items.map((item, index) => ({
    value: page * 10 + index + 1,
    type: '1',
    blocks: [{
      type: 'paragraph',
      text: [
        { type: 'bold', text: `${plain(item.title)} (${plain(item.year)})` },
        ' ',
        ...(item.messageLink
          ? [{ type: 'button', button: { text: `★ ${plain(item.rating)}/10`, url: item.messageLink, style: 'success' } }]
          : [{ type: 'bold', text: `★ ${plain(item.rating)}/10` }]),
      ],
    }],
  }));
  return { blocks: [
    heading('YOUR REVIEWS', 2),
    { type: 'list', items: listItems },
    footer(`Showing ${page * 10 + 1}–${page * 10 + items.length} of ${total} published reviews • Page ${page + 1}/${pageCount}`),
  ] };
}
