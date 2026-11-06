import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { reviews, reviewReactions } from '../schema.js';
import { categories, getRatingVerdict, ratingVerdicts } from './config.js';

const plain = (value) => String(value ?? '');

async function getProfilePhoto(userId) {
  try {
    const result = await api.getUserProfilePhotos({ user_id: userId, limit: 1 });
    const photo = result?.photos?.[0];
    if (!Array.isArray(photo) || !photo.length) return null;
    return photo[photo.length - 1]?.file_id ?? null;
  } catch (error) {
    console.warn('Could not load Telegram profile photo', error?.description || error?.message || error);
    return null;
  }
}

export async function showUserProfile(chatId, user, messageId = null) {
  const userId = Number(user?.id);
  if (!Number.isSafeInteger(userId) || userId < 1) throw new Error('Could not identify this Telegram profile.');
  const [allReviews, allVotes, rankingRows, photoFileId] = await Promise.all([
    db.select().from(reviews).where(eq(reviews.authorId, userId)).all(),
    db.select().from(reviewReactions).all(),
    db.select().from(reviews).all(),
    getProfilePhoto(userId),
  ]);
  const published = allReviews.filter((row) => row.status === 'published').sort((a, b) => b.id - a.id);
  const ownReviewIds = new Set(published.map((row) => row.id));
  const received = allVotes.filter((vote) => ownReviewIds.has(vote.reviewId));
  const likes = received.filter((vote) => vote.reaction === 'like').length;
  const dislikes = received.filter((vote) => vote.reaction === 'dislike').length;
  const legacyRated = published.filter((row) => Number.isFinite(Number(row.rating)) && row.rating != null && Number(row.rating) > 0);
  const average = legacyRated.length ? (legacyRated.reduce((sum, row) => sum + Number(row.rating), 0) / legacyRated.length).toFixed(1) : '—';
  const verdictCounts = ratingVerdicts.map((verdict) => ({ label: verdict.label, count: published.filter((row) => row.ratingVerdict === verdict.key).length })).filter((item) => item.count > 0);
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
    || published[0]?.authorName || 'Telegram user';
  const categoryCounts = categories.map((category) => ({
    label: category.label,
    count: published.filter((row) => row.categoryKey === category.key).length,
  })).filter((item) => item.count > 0);
  const totals = new Map();
  for (const row of rankingRows) if (row.status === 'published') totals.set(row.authorId, (totals.get(row.authorId) || 0) + 1);
  const ranking = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const rankIndex = ranking.findIndex(([id]) => id === userId);
  const topRank = rankIndex >= 0 && rankIndex < 20 ? rankIndex + 1 : null;
  const cells = [
    [{ text: 'Category', is_header: true }, { text: 'Reviews', is_header: true }],
    ...categoryCounts.map((item) => [{ text: item.label }, { text: String(item.count) }]),
  ];
  const recentItems = published.slice(0, 5).map((item, index) => {
    const verdict = getRatingVerdict(item.ratingVerdict);
    const ratingLabel = verdict?.label ?? (item.rating != null ? '★ ' + item.rating + '/10' : 'Not rated');
    const ratingStyle = verdict?.style ?? 'success';
    return ({
    value: index + 1,
    type: '1',
    blocks: [{
      type: 'paragraph',
      text: [
        { type: 'bold', text: plain(item.title) + (item.year ? ' (' + item.year + (item.endYear ? ' — ' + item.endYear : '') + ')' : '') },
        ' ',
        ...(item.messageLink
          ? [{ type: 'button', button: { text: ratingLabel, url: item.messageLink, style: ratingStyle } }]
          : [{ type: 'bold', text: ratingLabel }]),
      ],
    }],
  });
  });
  const blocks = [
    ...(photoFileId ? [{ type: 'photo', photo: { type: 'photo', media: photoFileId } }] : []),
    { type: 'heading', size: 1, text: 'YOUR PROFILE' },
    { type: 'heading', size: 2, text: name },
    ...(user.username ? [{ type: 'paragraph', text: '@' + plain(user.username) }] : []),
    { type: 'divider' },
    { type: 'table', cells: [
      [{ text: 'Statistic', is_header: true }, { text: 'Value', is_header: true }],
      [{ text: 'Published reviews' }, { text: String(published.length) }],
      [{ text: 'Average score (older reviews)' }, { text: legacyRated.length ? average + '/10' : '—' }],
      [{ text: 'Verdict-based reviews' }, { text: String(published.filter((row) => Boolean(getRatingVerdict(row.ratingVerdict))).length) }],
      [{ text: '👍 Received' }, { text: String(likes) }],
      [{ text: '👎 Received' }, { text: String(dislikes) }],
      [{ text: 'Leaderboard' }, { text: topRank ? '#' + topRank : 'Not in top 20' }],
    ], is_bordered: true, is_striped: true, is_compact: true },
    ...(verdictCounts.length ? [
      { type: 'heading', size: 3, text: 'Review verdicts' },
      { type: 'table', cells: [[{ text: 'Verdict', is_header: true }, { text: 'Reviews', is_header: true }], ...verdictCounts.map((item) => [{ text: item.label }, { text: String(item.count) }])], is_bordered: true, is_striped: true, is_compact: true },
    ] : []),
    ...(categoryCounts.length ? [
      { type: 'heading', size: 3, text: 'Reviews by category' },
      { type: 'table', cells, is_bordered: true, is_striped: true, is_compact: true },
    ] : []),
    { type: 'details', summary: 'Recent reviews', blocks: recentItems.length
      ? [{ type: 'list', items: recentItems }]
      : [{ type: 'paragraph', text: 'No reviews published yet. Start with your first review!' }] },
    { type: 'footer', text: 'Profile statistics are calculated from published reviews and recorded reactions.' },
  ];
  const params = {
    chat_id: chatId,
    rich_message: { blocks },
    reply_markup: { inline_keyboard: [
      [{ text: 'My Reviews', callback_data: 'rv:reviews:0' }, { text: 'Write a review', callback_data: 'rv:start' }],
      [{ text: '‹ Back', callback_data: 'rv:home' }],
    ] },
  };
  if (messageId) {
    params.message_id = messageId;
    return api.editMessageText(params);
  }
  return api.sendRichMessage(params);
}
