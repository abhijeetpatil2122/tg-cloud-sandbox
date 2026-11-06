import { categories, getNumericRatingStyle, getRatingVerdict } from './config.js';

const plain = (text) => String(text ?? '');
const heading = (text, size = 2) => ({ type: 'heading', size, text: plain(text) });
const paragraph = (text) => ({ type: 'paragraph', text });
const footer = (text) => ({ type: 'footer', text: plain(text) });

export function buildReviewRichMessage(data, reviewNumber = null, preview = false) {
  const blocks = [
    heading(data.categoryKey === 'anime' ? 'ANIME REVIEW' : data.categoryKey === 'tv_shows' ? 'TV SHOW REVIEW' : data.categoryKey === 'k_c_j_dramas' ? 'K/C/J DRAMA REVIEW' : data.categoryKey === 'international_movies' ? 'INTERNATIONAL MOVIE REVIEW' : 'MOVIE REVIEW', 2),
  ];
  const legacyMedia=data.posterMedia||data.posterFileId||data.posterUrl;
  const media=Array.isArray(data.media)?data.media:(legacyMedia?[{type:'photo',media:legacyMedia}]:[]);
  const selectedMedia=data.mediaMode==='single'?media.slice(0,1):media;
  const photoBlock=item=>({type:'photo',photo:{type:'photo',media:item.media,...(data.hasSpoilers?{has_spoiler:true}:{})}});
  if(selectedMedia.length===1)blocks.push(photoBlock(selectedMedia[0]));
  else if(selectedMedia.length>1)blocks.push({type:'slideshow',blocks:selectedMedia.map(photoBlock)});
  const verdict = getRatingVerdict(data.ratingVerdict);
  const ratingLabel = data.rating != null ? `★ ${plain(data.rating)}/10` : 'Not rated';
  const ratingStyle = getNumericRatingStyle(data.rating);
  blocks.push(
    heading(`${plain(data.title)}${data.year ? ` (${plain(data.year)}${data.endYear ? ` — ${plain(data.endYear)}` : ''})` : ''}`, 1),
    ...(data.genre ? [paragraph(plain(data.genre))] : []),
    ...(['tv_shows', 'k_c_j_dramas'].includes(data.categoryKey) && data.season ? [paragraph(`Season ${plain(data.season)}`)] : []),
    paragraph([
      { type: 'button', button: { text: ratingLabel, style: ratingStyle, disabled: {} } },
      ...(verdict ? ['  ', { type: 'button', button: { text: verdict.label, style: verdict.style, disabled: {} } }] : []),
      ...(data.hasSpoilers ? ['  ', { type: 'button', button: { text: 'SPOILER', style: 'danger', disabled: {} } }] : []),
    ]),
    { type: 'divider' },
    heading('Review', 3),
    {
      type: 'expandable_blockquote',
      text: data.hasSpoilers
        ? { type: 'spoiler', text: plain(data.reviewText) }
        : plain(data.reviewText),
    },
    { type: 'divider' },
    footer(`Reviewed by ${plain(data.authorName || 'Telegram user')}   •   ${preview ? 'Preview' : `Review #${String(reviewNumber).padStart(3, '0')}`}`),
  );
  return { blocks };
}

export function buildReviewKeyboard(data, mode = 'preview', reviewId = null, counts = { likes: 0, dislikes: 0 }, userReaction = null) {
  if (mode === 'preview') {
    return { inline_keyboard: [
      [{ text: 'Publish review', callback_data: 'rv:publish', style: 'success' }],
      [
        { text: 'Edit details', callback_data: 'rv:edit:menu' },
        { text: 'Cancel', callback_data: 'rv:cancel', style: 'danger' },
      ],
    ] };
  }
  if (mode === 'published') return { inline_keyboard: [
    [{ text: `👍 ${counts.likes}`, callback_data: `rv:react:${reviewId}:like` }, { text: `👎 ${counts.dislikes}`, callback_data: `rv:react:${reviewId}:dislike` }],
  ] };
  const category = categories.find((item) => item.key === data.categoryKey);
  return { inline_keyboard: [
    [{ text: `★ ${data.rating}/10`, callback_data: 'rv:noop', style: getNumericRatingStyle(data.rating), disabled: true }, ...(getRatingVerdict(data.ratingVerdict) ? [{ text: getRatingVerdict(data.ratingVerdict).label, callback_data: 'rv:noop', style: getRatingVerdict(data.ratingVerdict).style, disabled: true }] : [])],
    [
      { text: category?.label ?? 'Review', callback_data: 'rv:noop', style: 'primary', disabled: true },
      ...(data.year ? [{text:`${data.year}${data.endYear ? ` — ${data.endYear}` : ''}`,callback_data:'rv:noop',style:'primary',disabled:true}] : []),
      ...(data.season ? [{ text: `Season ${data.season}`, callback_data: 'rv:noop', style: 'primary', disabled: true }] : []),
    ],
  ] };
}

export function buildEditKeyboard() {
  const fields = [
    ['title', 'Title'], ['year', 'Year'], ['genre', 'Genre'], ['season', 'Season'],
    ['rating', 'Numeric rating'], ['verdict', 'Personal verdict'], ['text', 'Review text'], ['media', 'Photos'], ['spoiler', 'Spoilers'],
  ];
  return { inline_keyboard: [
    ...fields.map(([key, label]) => [{ text: label, callback_data: `rv:edit:${key}` }]),
    [{ text: 'Back to preview', callback_data: 'rv:preview' }],
  ] };
}

export function buildHelpRichMessage(isAdmin = false) {
  const communityButton = { type: 'button', button: { text: '@Review_Tv', url: 'https://t.me/Review_Tv' } };
  return { blocks: [
    heading('❓ Help & Commands', 1),
    paragraph('Browse community reviews or publish your own. Every review has a 1–10 rating; a personal verdict is optional.'),
    { type: 'divider' },
    heading('Commands', 3),
    { type: 'list', items: [
      { blocks: [paragraph('/start — Open the welcome menu')] },
      { blocks: [paragraph('/help — Show this command list')] },
      { blocks: [paragraph('/howtouse — View the submission guide')] },
      { blocks: [paragraph('/review — Submit a review'), { type: 'list', items: [{ blocks: [paragraph('/myreviews — View your published reviews')] }] }] },
      { blocks: [paragraph('/profile — View your reviewer profile')] },
      { blocks: [paragraph('/cancel — Cancel your active draft')] },
    ] },
    ...(isAdmin ? [{ type: 'divider' }, heading('Administration', 3), paragraph([{ type: 'bold', text: '/admin' }, ' — Open the private admin panel.'])] : []),
    { type: 'divider' },
    { type: 'footer', text: ['Published in the community: ', communityButton, '. Guide: /howtouse.'] },
  ] };
}

export function buildHowToRichMessage() {
  const sample = buildReviewRichMessage({
    categoryKey: 'tv_shows', title: 'Sample Series', year: 2020, endYear: 2024,
    genre: '#Drama, #Mystery', season: 2, rating: 9, ratingVerdict: 'absolute_cinema',
    reviewText: 'A well-paced series with strong performances and a satisfying story.',
    authorName: 'Reviewer', hasSpoilers: false,
  }, 1, false);
  return { blocks: [
    heading('How to submit a review', 1),
    paragraph('Send /review in your private chat. Your draft is saved as you go and is published only after you confirm the preview.'),
    { type: 'list', items: [
      { value: 1, type: '1', blocks: [paragraph('Choose a category, then enter the title and release year. TV Shows & Series and K/C/J Dramas also ask for an optional end year and season.')] },
      { value: 2, type: '1', blocks: [paragraph('Add genres if you wish. Choose a required rating from 1–10, then select an optional verdict or skip it.')] },
      { value: 3, type: '1', blocks: [paragraph('Write 20–5,000 characters, optionally add photos, set the spoiler option, and check the preview before publishing.')] },
    ] },
    { type: 'paragraph', text: [{ type: 'bold', text: 'Rating colours: ' }, { type: 'marked', text: '1–4 danger' }, ' · ', { type: 'marked', text: '5–7 primary' }, ' · ', { type: 'marked', text: '8–10 success' }, '. Verdict buttons use their own styles.'] },
    { type: 'details', summary: 'Preview example', blocks: sample.blocks },
  ] };
}

export function buildMyReviewsRichMessage(items, page, pageCount, total) {
  const listItems = items.map((item, index) => {
    const label = item.rating != null ? `★ ${plain(item.rating)}/10` : 'Not rated';
    const style = getNumericRatingStyle(item.rating);
    return ({
    value: page * 10 + index + 1,
    type: '1',
    blocks: [{
      type: 'paragraph',
      text: [
        { type: 'bold', text: `${plain(item.title)}${item.year ? ` (${plain(item.year)}${item.endYear ? ` — ${plain(item.endYear)}` : ''})` : ''}` },
        ' ',
        ...(item.messageLink
          ? [{ type: 'button', button: { text: label, url: item.messageLink, style } }]
          : [{ type: 'bold', text: label }]),
      ],
    }],
  });
  });
  return { blocks: [
    heading('YOUR REVIEWS', 2),
    { type: 'list', items: listItems },
    footer(`Showing ${page * 10 + 1}–${page * 10 + items.length} of ${total} published reviews • Page ${page + 1}/${pageCount}`),
  ] };
}
