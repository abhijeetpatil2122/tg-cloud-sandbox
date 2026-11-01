import { table, integer, text, index } from 'sdk/db';

export const botSettings = table('bot_settings', {
  id: integer('id').primaryKey(),
  ownerTgId: integer('owner_tg_id'),
  sarvamApiKey: text('sarvam_api_key'),
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
