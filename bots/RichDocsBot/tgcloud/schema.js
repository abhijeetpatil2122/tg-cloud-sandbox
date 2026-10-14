import { table, integer, sql } from 'sdk/db';

// Aggregate counters avoid storing every query or its text.
export const inlineUsageStats = table('inline_usage_stats', {
  id: integer('id').primaryKey(),
  totalQueries: integer('total_queries').notNull().default(0),
  docsQueries: integer('docs_queries').notNull().default(0),
  errorQueries: integer('error_queries').notNull().default(0),
});

// Keep one row per Telegram user so /stats can report distinct users without
// retaining inline query text or growing an event log indefinitely.
export const inlineUsageUsers = table('inline_usage_users', {
  userId: integer('user_id').primaryKey(),
  firstSeen: integer('first_seen', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  lastSeen: integer('last_seen', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});
