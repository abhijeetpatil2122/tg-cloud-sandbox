import { api, db } from 'sdk';
import { eq, sql } from 'sdk/db';
import { categoryTopics, communityConfig, reviews, topicCounters } from '../schema.js';
import { getCategory } from './config.js';
import { buildReviewRichMessage } from './formatting.js';

const CONFIG_ID = 1;

async function getDestination(categoryKey) {
  const config = await db.select().from(communityConfig).where(eq(communityConfig.id, CONFIG_ID)).get();
  const mapping = await db.select().from(categoryTopics).where(eq(categoryTopics.categoryKey, categoryKey)).get();
  if (!config?.enabled || !mapping || mapping.chatId !== config.chatId) throw new Error('This review category is not connected to a publishing topic yet.');
  return { config, mapping };
}

async function nextNumber(categoryKey) {
  const [row] = await db.insert(topicCounters).values({ categoryKey, lastNumber: 1 })
    .onConflictDoUpdate({
      target: topicCounters.categoryKey,
      set: { lastNumber: sql`${topicCounters.lastNumber} + 1` },
    }).returning().run();
  return row.lastNumber;
}

function makeMessageLink(chatId, messageId, topicId, username) {
  if (username) return `https://t.me/${username}/${messageId}`;
  const internalId = String(chatId).replace(/^-100/, '');
  return `https://t.me/c/${internalId}/${messageId}?thread=${topicId}`;
}

export async function publishReview(userId, draft) {
  if (!draft || draft.step !== 'complete') throw new Error('Your review is not ready to publish.');
  const data = { ...draft.data };
  const category = getCategory(data.categoryKey);
  if (!category || !data.title || !data.reviewText || !Number.isInteger(data.rating)) throw new Error('The review is missing required details.');
  const { config, mapping } = await getDestination(data.categoryKey);
  const reviewNumber = await nextNumber(data.categoryKey);
  const authorName = data.authorName || 'Telegram user';

  const inserted = await db.insert(reviews).values({
    reviewNumber, authorId: userId, authorName, categoryKey: data.categoryKey,
    title: data.title, year: data.year, season: data.season ?? null, rating: data.rating,
    reviewText: data.reviewText, posterFileId: data.posterFileId ?? data.posterUrl ?? data.posterMedia ?? null,
    hasSpoilers: Boolean(data.hasSpoilers), status: 'publishing',
    chatId: config.chatId, topicId: mapping.topicId, createdAt: new Date(),
  }).returning().run();
  const [reviewRecord] = inserted;

  try {
    const sent = await api.sendRichMessage({
      chat_id: config.chatId,
      message_thread_id: mapping.topicId,
      rich_message: buildReviewRichMessage({ ...data, authorName }, reviewNumber, false),
    });
    let username = null;
    try {
      const chat = await api.getChat({ chat_id: config.chatId });
      username = chat?.username || null;
    } catch (error) {
      console.warn('Could not resolve the public forum username; using the private chat link format.', error?.description || error?.message || error);
    }
    const link = makeMessageLink(config.chatId, sent.message_id, mapping.topicId, username);
    await db.update(reviews).set({
      status: 'published', messageId: sent.message_id, messageLink: link, publishedAt: new Date(),
    }).where(eq(reviews.id, reviewRecord.id)).run();
    return { reviewNumber, link, messageId: sent.message_id, category };
  } catch (error) {
    await db.update(reviews).set({ status: 'failed' }).where(eq(reviews.id, reviewRecord.id)).run();
    throw error;
  }
}
