import { table, integer, text, index, uniqueIndex } from 'sdk/db';

export const botSettings = table('bot_settings', {
  id: integer('id').primaryKey(),
  ownerTgId: integer('owner_tg_id'),
  sarvamApiKey: text('sarvam_api_key'),
  tavilyApiKey: text('tavily_api_key'),
});

export const conversationMessages = table('conversation_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userTgId: integer('user_tg_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (t) => ({
  userCreatedIdx: index('idx_conversation_messages_user_created').on(t.userTgId, t.createdAt),
}));

// Each draft is independently stoppable. A stopped update is delivered in a
// separate Serverless invocation, so the generation state must live in SQLite.
export const activeGenerations = table('active_generations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chatId: integer('chat_id').notNull(),
  draftId: integer('draft_id').notNull(),
  userTgId: integer('user_tg_id').notNull(),
  status: text('status').notNull().default('running'),
  partialText: text('partial_text').notNull().default(''),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (t) => ({
  chatDraftUnique: uniqueIndex('uq_active_generations_chat_draft').on(t.chatId, t.draftId),
  statusIdx: index('idx_active_generations_status').on(t.status),
}));
