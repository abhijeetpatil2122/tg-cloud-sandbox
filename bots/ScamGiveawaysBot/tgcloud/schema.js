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

export const scamReports = table('scam_reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reporterId: integer('reporter_id').notNull(),
  scammerHandle: text('scammer_handle').notNull(),
  amount: text('amount').notNull(),
  summary: text('summary').notNull(),
  proofChannel: text('proof_channel').notNull(),
  status: text('status').notNull().default('private_preview'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  reporterIdx: index('idx_scam_reports_reporter').on(t.reporterId),
  createdIdx: index('idx_scam_reports_created').on(t.createdAt),
}));
