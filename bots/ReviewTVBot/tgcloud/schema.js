import { table, integer, text, boolean, sql, uniqueIndex, index } from 'sdk/db';

export const communityConfig = table('community_config', {
  id: integer('id').primaryKey(),
  chatId: integer('chat_id').notNull(),
  chatTitle: text('chat_title').notNull(),
  ownerId: integer('owner_id').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  connectedAt: integer('connected_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const categoryTopics = table('category_topics', {
  categoryKey: text('category_key').primaryKey(),
  chatId: integer('chat_id').notNull(),
  topicId: integer('topic_id').notNull(),
  configuredBy: integer('configured_by').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const reviewDrafts = table('review_drafts', {
  userId: integer('user_id').primaryKey(),
  chatId: integer('chat_id').notNull(),
  step: text('step').notNull(),
  payload: text('payload').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const topicCounters = table('topic_counters', {
  categoryKey: text('category_key').primaryKey(),
  lastNumber: integer('last_number').notNull().default(0),
});

export const reviews = table('reviews', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reviewNumber: integer('review_number').notNull(),
  authorId: integer('author_id').notNull(),
  authorName: text('author_name').notNull(),
  categoryKey: text('category_key').notNull(),
  title: text('title').notNull(),
  year: integer('year').notNull(),
  endYear: integer('end_year'),
  season: integer('season'),
  rating: integer('rating').notNull(),
  ratingVerdict: text('rating_verdict'),
  reviewText: text('review_text').notNull(),
  posterFileId: text('poster_file_id'),
  hasSpoilers: boolean('has_spoilers').notNull().default(false),
  status: text('status').notNull(),
  chatId: integer('chat_id').notNull(),
  topicId: integer('topic_id').notNull(),
  messageId: integer('message_id'),
  messageLink: text('message_link'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
});


export const reviewReactions = table('review_reactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reviewId: integer('review_id').notNull(),
  userId: integer('user_id').notNull(),
  reaction: text('reaction').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  reviewUserUnique: uniqueIndex('uq_review_reactions_review_user').on(t.reviewId, t.userId),
  reviewIdx: index('idx_review_reactions_review').on(t.reviewId),
}));


export const leaderboardState = table('leaderboard_state', {
  id: integer('id').primaryKey(),
  chatId: integer('chat_id').notNull(),
  topicId: integer('topic_id').notNull(),
  messageId: integer('message_id').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});
