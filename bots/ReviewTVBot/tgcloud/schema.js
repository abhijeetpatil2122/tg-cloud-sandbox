import { table, integer, text, boolean, sql } from 'sdk/db';

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
