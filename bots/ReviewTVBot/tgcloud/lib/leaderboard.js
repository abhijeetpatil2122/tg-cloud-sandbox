import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { categoryTopics, communityConfig, leaderboardState, reviews } from '../schema.js';

const STATE_ID = 1;
const LIMIT = 20;

async function getLeaderboardRows() {
  const rows = await db.select().from(reviews).all();
  const published = rows.filter((row) => row.status === 'published');
  const grouped = new Map();
  for (const review of published) {
    const current = grouped.get(review.authorId) || { userId: review.authorId, name: review.authorName || 'Telegram user', count: 0 };
    current.count += 1;
    if (review.id > (current.latestId || 0)) {
      current.latestId = review.id;
      current.name = review.authorName || current.name;
    }
    grouped.set(review.authorId, current);
  }
  return [...grouped.values()]
    .sort((a, b) => b.count - a.count || a.userId - b.userId)
    .slice(0, LIMIT);
}

export async function buildLeaderboardMessage() {
  const leaders = await getLeaderboardRows();
  const cells = [
    [{ text: '#', is_header: true }, { text: 'Reviewer', is_header: true }, { text: 'Reviews', is_header: true }],
    ...leaders.map((item, index) => [
      { text: index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : String(index + 1) },
      { text: item.name },
      { text: String(item.count) },
    ]),
  ];
  if (!leaders.length) cells.push([{ text: '—' }, { text: 'No reviews published yet' }, { text: '0' }]);
  return { blocks: [
    { type: 'heading', size: 1, text: '🏆 TOP 20 REVIEWERS' },
    { type: 'paragraph', text: 'Community leaderboard ranked by the number of successfully published reviews.' },
    { type: 'table', cells, is_bordered: true, is_striped: true, is_compact: true },
    { type: 'footer', text: 'Automatically updated after each successful review publication.' },
  ] };
}

async function getDestination() {
  const config = await db.select().from(communityConfig).where(eq(communityConfig.id, 1)).get();
  const mapping = await db.select().from(categoryTopics).where(eq(categoryTopics.categoryKey, 'leaderboard')).get();
  if (!config?.enabled || !mapping || mapping.chatId !== config.chatId) {
    throw new Error('Configure the Leaderboard topic first with /settopic leaderboard.');
  }
  return { chatId: config.chatId, topicId: mapping.topicId };
}

async function saveState(destination, messageId) {
  const now = new Date();
  await db.insert(leaderboardState).values({
    id: STATE_ID, chatId: destination.chatId, topicId: destination.topicId, messageId, updatedAt: now,
  }).onConflictDoUpdate({
    target: leaderboardState.id,
    set: { chatId: destination.chatId, topicId: destination.topicId, messageId, updatedAt: now },
  }).run();
}

export async function refreshLeaderboard({ forceNew = false } = {}) {
  const destination = await getDestination();
  const richMessage = await buildLeaderboardMessage();
  const state = await db.select().from(leaderboardState).where(eq(leaderboardState.id, STATE_ID)).get();
  if (!forceNew && state && state.chatId === destination.chatId && state.topicId === destination.topicId) {
    try {
      await api.editMessageText({
        chat_id: destination.chatId, message_id: state.messageId, rich_message: richMessage,
        reply_markup: { inline_keyboard: [] },
      });
      return { messageId: state.messageId, replaced: false };
    } catch (error) {
      const reason = String(error?.description || error?.message || error);
      if (/message is not modified/i.test(reason)) return { messageId: state.messageId, replaced: false, unchanged: true };
      console.warn('Stored leaderboard message could not be edited; creating a replacement', reason);
    }
  }
  const sent = await api.sendRichMessage({
    chat_id: destination.chatId, message_thread_id: destination.topicId,
    rich_message: richMessage, reply_markup: { inline_keyboard: [] },
  });
  await saveState(destination, sent.message_id);
  return { messageId: sent.message_id, replaced: Boolean(state) };
}
