import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { reviews, reviewReactions } from '../schema.js';
import { categories } from './config.js';

const plain = (value) => String(value ?? '');

export async function showUserProfile(chatId, user, messageId = null) {
  const userId = Number(user?.id);
  if (!Number.isSafeInteger(userId) || userId < 1) throw new Error('Could not identify this Telegram profile.');
  const allReviews = await db.select().from(reviews).where(eq(reviews.authorId, userId)).all();
  const published = allReviews.filter((row) => row.status === 'published').sort((a, b) => b.id - a.id);
  const allVotes = await db.select().from(reviewReactions).all();
  const ownReviewIds = new Set(published.map((row) => row.id));
  const received = allVotes.filter((vote) => ownReviewIds.has(vote.reviewId));
  const likes = received.filter((vote) => vote.reaction === 'like').length;
  const dislikes = received.filter((vote) => vote.reaction === 'dislike').length;
  const average = published.length
    ? (published.reduce((sum, row) => sum + Number(row.rating || 0), 0) / published.length).toFixed(1)
    : '—';
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
    || published[0]?.authorName || 'Telegram user';
  const categoryCounts = categories.map((category) => ({
    label: category.label,
    count: published.filter((row) => row.categoryKey === category.key).length,
  })).filter((item) => item.count > 0);
  const rankingRows = await db.select().from(reviews).all();
  const totals = new Map();
  for (const row of rankingRows) if (row.status === 'published') totals.set(row.authorId, (totals.get(row.authorId) || 0) + 1);
  const ranking = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const rankIndex = ranking.findIndex(([id]) => id === userId);
  const topRank = rankIndex >= 0 && rankIndex < 20 ? rankIndex + 1 : null;
  const cells = [
    [{ text: 'Category', is_header: true }, { text: 'Reviews', is_header: true }],
    ...categoryCounts.map((item) => [{ text: item.label }, { text: String(item.count) }]),
  ];
  const blocks = [
    { type: 'heading', size: 1, text: 'YOUR PROFILE' },
    { type: 'heading', size: 2, text: name },
    ...(user.username ? [{ type: 'paragraph', text: '@' + plain(user.username) }] : []),
    { type: 'divider' },
    { type: 'table', cells: [
      [{ text: 'Statistic', is_header: true }, { text: 'Value', is_header: true }],
      [{ text: 'Published reviews' }, { text: String(published.length) }],
      [{ text: 'Average rating given' }, { text: published.length ? average + '/10' : '—' }],
      [{ text: '👍 Received' }, { text: String(likes) }],
      [{ text: '👎 Received' }, { text: String(dislikes) }],
      [{ text: 'Leaderboard' }, { text: topRank ? '#' + topRank : 'Not in top 20' }],
    ], is_bordered: true, is_striped: true, is_compact: true },
    ...(categoryCounts.length ? [
      { type: 'heading', size: 3, text: 'Reviews by category' },
      { type: 'table', cells, is_bordered: true, is_striped: true, is_compact: true },
    ] : []),
    { type: 'divider' },
    { type: 'heading', size: 3, text: 'Recent reviews' },
    ...(published.length ? [{ type: 'list', items: published.slice(0, 5).map((item, index) => ({
      value: index + 1, type: '1', blocks: [{ type: 'paragraph', text: [
        { type: 'bold', text: plain(item.title) + (item.year ? ' (' + item.year + (item.endYear ? ' — ' + item.endYear : '') + ')' : '') },
        ' ',
        ...(item.messageLink ? [{ type: 'button', button: { text: '★ ' + item.rating + '/10', url: item.messageLink, style: 'success' } }] : [{ type: 'bold', text: '★ ' + item.rating + '/10' }]),
      ] }],
    })) }] : [{ type: 'paragraph', text: 'No reviews published yet. Start with your first review!' }]),
    { type: 'footer', text: 'Profile statistics are calculated from published reviews and recorded reactions.' },
  ];
  const params = {
    chat_id: chatId, rich_message: { blocks },
    reply_markup: { inline_keyboard: [
      [{ text: 'My Reviews', callback_data: 'rv:reviews:0' }, { text: 'Write a review', callback_data: 'rv:start' }],
    ] },
  };
  if (messageId) {
    params.message_id = messageId;
    return api.editMessageText(params);
  }
  return api.sendRichMessage(params);
}
