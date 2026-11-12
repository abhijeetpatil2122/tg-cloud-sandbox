import { table, integer, text, sql, index } from 'sdk/db';

export const reportDrafts = table('report_drafts', {
  userId: integer('user_id').primaryKey(),
  chatId: integer('chat_id').notNull(),
  promptMessageId: integer('prompt_message_id').notNull(),
  step: text('step').notNull(),
  scammerHandle: text('scammer_handle'),
  amount: text('amount'),
  summary: text('summary'),
  proofChannel: text('proof_channel'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const adminSessions = table('admin_sessions', {
  userId: integer('user_id').primaryKey(),
  chatId: integer('chat_id').notNull(),
  promptMessageId: integer('prompt_message_id').notNull(),
  step: text('step').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const botSettings = table('bot_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const botUsers = table('bot_users', {
  userId: integer('user_id').primaryKey(),
  username: text('username'),
  firstName: text('first_name').notNull(),
  lastName: text('last_name'),
  firstStartedAt: integer('first_started_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  lastStartedAt: integer('last_started_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  startCount: integer('start_count').notNull().default(1),
}, (t) => ({
  usernameIdx: index('idx_bot_users_username').on(t.username),
  firstStartedIdx: index('idx_bot_users_first_started').on(t.firstStartedAt),
}));

export const scamReports = table('scam_reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reporterId: integer('reporter_id').notNull(),
  scammerHandle: text('scammer_handle').notNull(),
  amount: text('amount').notNull(),
  summary: text('summary').notNull(),
  proofChannel: text('proof_channel').notNull(),
  // Existing rows are initialized to pending_review during the SQLite migration.
  // Keep the default so every future insert has a valid moderation state.
  status: text('status').notNull().default('pending_review'),
  reviewedBy: integer('reviewed_by'),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
  publishedChatId: text('published_chat_id'),
  publishedMessageId: integer('published_message_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  reporterIdx: index('idx_scam_reports_reporter').on(t.reporterId),
  createdIdx: index('idx_scam_reports_created').on(t.createdAt),
  statusIdx: index('idx_scam_reports_status').on(t.status),
}));
