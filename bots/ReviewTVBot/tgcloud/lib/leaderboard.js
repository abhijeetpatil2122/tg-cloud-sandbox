import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { categoryTopics, communityConfig, leaderboardState, reviews } from '../schema.js';

const STATE_ID = 1;
const LIMIT = 20;

const LEADERBOARD_TAG_PATTERN = /^#(?:[1-9]|1[0-9]|20) Reviewer$/;

function isLeaderboardTag(tag) {
  return typeof tag === 'string' && LEADERBOARD_TAG_PATTERN.test(tag);
}

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

export async function syncLeaderboardMemberTag(chatId, userId) {
  try {
    const config = await db.select().from(communityConfig).where(eq(communityConfig.id, 1)).get();
    if (!config?.enabled || config.chatId !== chatId) return;

    const [leaders, member] = await Promise.all([
      getLeaderboardRows(),
      api.getChatMember({ chat_id: chatId, user_id: userId }),
    ]);

    // Telegram member tags are for regular members, not group administrators.
    if (!member || member.status === 'creator' || member.status === 'administrator') return;
    if (member.status !== 'member' && !(member.status === 'restricted' && member.is_member)) return;

    const rankIndex = leaders.findIndex((leader) => leader.userId === userId);
    const desiredTag = rankIndex >= 0 ? `#${rankIndex + 1} Reviewer` : '';
    const currentTag = typeof member.tag === 'string' ? member.tag : '';

    if (desiredTag) {
      if (currentTag === desiredTag) return;
      // Do not overwrite a tag that is not owned by this leaderboard feature.
      if (currentTag && !isLeaderboardTag(currentTag)) return;
    } else if (!isLeaderboardTag(currentTag)) {
      return;
    }

    await api.setChatMemberTag({ chat_id: chatId, user_id: userId, tag: desiredTag });
  } catch (error) {
    // Tag failures must never interfere with normal General-topic messages.
    console.warn('Leaderboard member tag sync failed', error?.description || error?.message || error);
  }
}

export async function buildLeaderboardMessage() {
  const leaders = await getLeaderboardRows();
  const cell = (text, align = 'left', isHeader = false) => ({ text: String(text), align, valign: 'middle', ...(isHeader ? { is_header: true } : {}) });
  const cells = [
    [cell('#', 'center', true), cell('Reviewer', 'left', true), cell('Reviews', 'right', true)],
    ...leaders.map((item, index) => [
      cell(index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1, 'center'),
      cell(item.name, 'left'),
      cell(item.count, 'right'),
    ]),
  ];
  if (!leaders.length) cells.push([cell('—', 'center'), cell('No reviews published yet', 'left'), cell('0', 'right')]);
  return { blocks: [
    { type: 'heading', size: 1, text: '🏆 Top 20 Reviewers' },
    { type: 'table', cells, is_striped: true, caption: 'Ranked by published review count' },
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
