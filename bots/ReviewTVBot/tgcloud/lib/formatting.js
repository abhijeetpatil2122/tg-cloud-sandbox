import { categories, getNumericRatingStyle, getRatingVerdict } from './config.js';

const plain = (text) => String(text ?? '');
const heading = (text, size = 2) => ({ type: 'heading', size, text: plain(text) });
const paragraph = (text) => ({ type: 'paragraph', text });
const footer = (text) => ({ type: 'footer', text: plain(text) });

function categoryMediaCaption(categoryKey) {
  if (categoryKey === 'anime') return '✨ A glimpse into the anime';
  if (categoryKey === 'tv_shows') return '📺 A glimpse of the series';
  if (categoryKey === 'k_c_j_dramas') return '🎭 A glimpse of the drama';
  return '🎬 A glimpse of the film';
}

export function buildReviewRichMessage(data, reviewNumber = null, preview = false, mediaCaptionOverride = null) {
  const blocks = [
    heading(data.categoryKey === 'anime' ? 'ANIME REVIEW' : data.categoryKey === 'tv_shows' ? 'TV SHOW REVIEW' : data.categoryKey === 'k_c_j_dramas' ? 'K/C/J DRAMA REVIEW' : data.categoryKey === 'international_movies' ? 'INTERNATIONAL MOVIE REVIEW' : 'MOVIE REVIEW', 2),
  ];
  const legacyMedia=data.posterMedia||data.posterFileId||data.posterUrl;
  const media=Array.isArray(data.media)?data.media:(legacyMedia?[{type:'photo',media:legacyMedia}]:[]);
  const selectedMedia=data.mediaMode==='single'?media.slice(0,1):media;
  const photoBlock=item=>({type:'photo',photo:{type:'photo',media:item.media,...(data.hasSpoilers?{has_spoiler:true}:{})}});
  if(selectedMedia.length===1)blocks.push(photoBlock(selectedMedia[0]));
  else if(selectedMedia.length>1)blocks.push({type:'slideshow',blocks:selectedMedia.map(photoBlock),caption:{text:plain(mediaCaptionOverride || categoryMediaCaption(data.categoryKey))}});
  const verdict = getRatingVerdict(data.ratingVerdict) ?? (data.ratingVerdictLabel ? { label: plain(data.ratingVerdictLabel), style: data.ratingVerdictStyle || 'success' } : null);
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
  const guideButton = { type: 'button', button: { text: 'How to use', callback_data: 'rv:howto', style: 'link' } };
  return { blocks: [
    heading('❓ Help & Commands', 1),
    paragraph('Browse community reviews or publish your own. Every review has a required 1–10 rating; a personal verdict is optional.'),
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
    { type: 'footer', text: ['Published in the community: ', communityButton, '  ', guideButton] },
  ] };
}

export function buildHowToRichMessage() {
  const sample = buildReviewRichMessage({
    categoryKey: 'bollywood_movies',
    title: 'Ramayana: Rise of a Legend',
    year: 2026,
    genre: '#Mythology, #Action, #Adventure, #Drama',
    rating: 9.5,
    ratingVerdictLabel: 'Peak',
    ratingVerdictStyle: 'success',
    media: [
      { type: 'photo', media: 'https://image.tmdb.org/t/p/original/ysoJexwslfJnSXcHNNF1A9EtDbB.jpg' },
      { type: 'photo', media: 'https://image.tmdb.org/t/p/original/ks72NqTPhpupk207NXiqmZIQQVI.jpg' },
      { type: 'photo', media: 'https://image.tmdb.org/t/p/original/xmtdDK5FaBgwDPc9oUSRDmBFJfm.jpg' },
      { type: 'photo', media: 'https://image.tmdb.org/t/p/original/f5Lq2ndFETM1V5RNmFhpl2FKrHL.jpg' },
      { type: 'photo', media: 'https://image.tmdb.org/t/p/original/tyL4w11gLjensmsZqW46niGBa4V.jpg' },
    ],
    mediaMode: 'slideshow',
    
    reviewText: 'A breathtaking cinematic retelling that brings the world of the Ramayana to life with magnificent visuals, grand kingdoms and spectacular large-scale sequences. The production design is rich with detail, every frame feels crafted for the big screen, and the action delivers an unforgettable sense of scale. Hans Zimmer and A. R. Rahman’s powerful score adds emotion and grandeur throughout. Ranbir Kapoor brings a compelling presence to Rama, Sai Pallavi adds grace and warmth as Sita, and Yash makes Ravana truly commanding. With its visual splendour, moving moments and epic atmosphere, this is a spectacular theatrical experience that celebrates the timeless legend. Absolute peak cinema.',
    authorName: 'ReviewTV Community',
    hasSpoilers: false,
  }, null, true, 'A glimpse into the legend');
  return { blocks: [
    heading('📖 How to submit a review', 1),
    paragraph('Send /review in your private chat. Your draft is saved as you go and is published only after you confirm the preview.'),
    { type: 'list', items: [
      { value: 1, type: '1', blocks: [paragraph('Choose a category, then enter the title and release year. TV Shows & Series and K/C/J Dramas also ask for an optional end year and season.')] },
      { value: 2, type: '1', blocks: [paragraph('Add genres if you wish. Choose a required rating from 1–10, then select an optional verdict or skip it.')] },
      { value: 3, type: '1', blocks: [paragraph('Write your review (20–5,000 characters). Add Telegram photos or multiple direct HTTPS image URLs separated by commas (up to 10 images), set the spoiler option, and check the preview before publishing.')] },
    ] },
    { type: 'details', summary: 'Example review · Ramayana: Rise of a Legend (2026)', blocks: sample.blocks },
  ] };
}

export function buildAdminPanelRichMessage() {
  return { blocks: [
    heading('🛠️ Admin Panel', 1),
    paragraph('Manage forum publishing, review statistics and test data.'),
    { type: 'divider' },
    heading('Admin commands', 3),
    { type: 'list', items: [
      { blocks: [paragraph([{ type: 'bold', text: '/admin' }, ' — Open this panel'])] },
      { blocks: [paragraph([{ type: 'bold', text: '/stats' }, ' — View review totals'])] },
      { blocks: [paragraph([{ type: 'bold', text: '/leaderboard' }, ' — Initialize or refresh the leaderboard'])] },
      { blocks: [paragraph([{ type: 'bold', text: '/settings' }, ' — View forum and topic setup'])] },
      { blocks: [paragraph([{ type: 'bold', text: '/connect' }, ' — Connect the forum (creator only)'])] },
      { blocks: [paragraph([{ type: 'bold', text: '/settopic <category_key>' }, ' — Map the current topic'])] },
      { blocks: [paragraph([{ type: 'bold', text: '/disconnect confirm' }, ' — Pause review publishing'])] },
      { blocks: [paragraph([{ type: 'bold', text: '/resetdb' }, ' — Clear saved test data after confirmation'])] },
    ] },
    { type: 'divider' },
    { type: 'footer', text: ['Authorized administrators only. ', { type: 'button', button: { text: 'Forum settings', callback_data: 'rv:admin:settings', style: 'link' } }] },
  ] };
}

export function buildAdminStatsRichMessage(rows) {
  const published = rows.filter((row) => row.status === 'published');
  const cell = (text, align = 'left', isHeader = false) => ({
    text: String(text), align, valign: 'middle', ...(isHeader ? { is_header: true } : {}),
  });
  const cells = [
    [cell('Category', 'left', true), cell('Published', 'right', true)],
    ...categories.map((category) => [
      cell(category.label, 'left'),
      cell(published.filter((row) => row.categoryKey === category.key).length, 'right'),
    ]),
    [cell('Total published', 'left'), cell(published.length, 'right')],
    [cell('Draft / failed', 'left'), cell(rows.length - published.length, 'right')],
  ];
  return { blocks: [
    heading('📊 Review Statistics', 1),
    { type: 'table', cells, is_striped: true, caption: 'Saved review records by category' },
    { type: 'footer', text: ['Statistics are based on the current database. ', { type: 'button', button: { text: 'Admin panel', callback_data: 'rv:admin:home', style: 'link' } }] },
  ] };
}

export function buildAdminResetConfirmation() {
  return { blocks: [
    heading('⚠️ Clear test data?', 1),
    paragraph('This permanently removes saved reviews, reaction votes, active drafts and review-number counters.'),
    paragraph('Your forum connection, topic mappings and leaderboard message will be kept. Existing posts in Telegram topics will not be deleted.'),
    { type: 'divider' },
    { type: 'footer', text: [
      { type: 'button', button: { text: 'Confirm reset', callback_data: 'rv:resetdb:confirm', style: 'danger' } },
      '  ',
      { type: 'button', button: { text: 'Cancel', callback_data: 'rv:resetdb:cancel', style: 'link' } },
    ] },
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
