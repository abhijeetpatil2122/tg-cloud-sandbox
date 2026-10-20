import { table, integer, text, index, uniqueIndex } from 'sdk/db';

// Only permanent app data: each Telegram user's saved chats.
// Upload session/chunk tables are temporary implementation storage for chunked uploads.
export const chats = table('saved_chats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerTgId: integer('owner_tg_id').notNull(),
  chatId: integer('chat_id').notNull(),
  title: text('title').notNull(),
  username: text('username'),
  type: text('type').notNull(),
  photoFileId: text('photo_file_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql\`(unixepoch())\`),
}, (t) => ({
  ownerChatUnique: uniqueIndex('uq_saved_chats_owner_chat').on(t.ownerTgId, t.chatId),
  ownerIdx: index('idx_saved_chats_owner').on(t.ownerTgId),
}));

export const mediaUploadSessions = table('media_upload_sessions', {
  uploadId: text('upload_id').primaryKey(),
  ownerTgId: integer('owner_tg_id').notNull(),
  kind: text('kind').notNull(),
  fileName: text('file_name').notNull(),
  fileType: text('file_type'),
  fileSize: integer('file_size').notNull(),
  totalChunks: integer('total_chunks').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql\`(unixepoch())\`),
}, (t) => ({
  ownerIdx: index('idx_media_upload_sessions_owner').on(t.ownerTgId),
  createdIdx: index('idx_media_upload_sessions_created').on(t.createdAt),
}));

export const mediaUploadChunks = table('media_upload_chunks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  uploadId: text('upload_id').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  base64: text('base64').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql\`(unixepoch())\`),
}, (t) => ({
  uploadChunkUnique: uniqueIndex('uq_media_upload_chunks_upload_index').on(t.uploadId, t.chunkIndex),
  uploadIdx: index('idx_media_upload_chunks_upload').on(t.uploadId),
  createdIdx: index('idx_media_upload_chunks_created').on(t.createdAt),
}));
