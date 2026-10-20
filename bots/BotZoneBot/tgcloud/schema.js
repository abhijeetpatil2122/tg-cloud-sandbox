import { table, integer, text, json, index, uniqueIndex, sql } from 'sdk/db';

export const users = table('app_users', {
  tgId: integer('tg_id').primaryKey(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  username: text('username'),
  firstSeen: integer('first_seen', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  lastSeen: integer('last_seen', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const chats = table('saved_chats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerTgId: integer('owner_tg_id').notNull(),
  chatId: integer('chat_id').notNull(),
  title: text('title').notNull(),
  username: text('username'),
  type: text('type').notNull(),
  photoFileId: text('photo_file_id'),
  source: text('source').notNull().default('manual'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  ownerChatUnique: uniqueIndex('uq_saved_chats_owner_chat').on(t.ownerTgId, t.chatId),
  ownerIdx: index('idx_saved_chats_owner').on(t.ownerTgId),
}));

export const shareRequests = table('chat_share_requests', {
  requestId: integer('request_id').primaryKey(),
  ownerTgId: integer('owner_tg_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  consumedAt: integer('consumed_at', { mode: 'timestamp' }),
}, (t) => ({
  ownerIdx: index('idx_chat_share_requests_owner').on(t.ownerTgId),
}));

export const mediaUploadSessions = table('media_upload_sessions', {
  uploadId: text('upload_id').primaryKey(),
  ownerTgId: integer('owner_tg_id').notNull(),
  kind: text('kind').notNull(),
  fileName: text('file_name').notNull(),
  fileType: text('file_type'),
  fileSize: integer('file_size').notNull(),
  totalChunks: integer('total_chunks').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  ownerIdx: index('idx_media_upload_sessions_owner').on(t.ownerTgId),
  createdIdx: index('idx_media_upload_sessions_created').on(t.createdAt),
}));

export const mediaUploadChunks = table('media_upload_chunks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  uploadId: text('upload_id').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  base64: text('base64').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  uploadChunkUnique: uniqueIndex('uq_media_upload_chunks_upload_index').on(t.uploadId, t.chunkIndex),
  uploadIdx: index('idx_media_upload_chunks_upload').on(t.uploadId),
  createdIdx: index('idx_media_upload_chunks_created').on(t.createdAt),
}));

export const mediaUploads = table('media_uploads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerTgId: integer('owner_tg_id').notNull(),
  fileId: text('file_id').notNull(),
  kind: text('kind').notNull(),
  fileName: text('file_name'),
  fileType: text('file_type'),
  fileSize: integer('file_size'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  ownerIdx: index('idx_media_uploads_owner').on(t.ownerTgId),
  createdIdx: index('idx_media_uploads_created').on(t.createdAt),
}));

export const events = table('app_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerTgId: integer('owner_tg_id'),
  eventType: text('event_type').notNull(),
  chatId: integer('chat_id'),
  metadata: json('metadata'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  ownerIdx: index('idx_app_events_owner').on(t.ownerTgId),
  typeIdx: index('idx_app_events_type').on(t.eventType),
  createdIdx: index('idx_app_events_created').on(t.createdAt),
}));
