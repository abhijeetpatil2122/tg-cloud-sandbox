import { db } from 'sdk';
import { and, asc, desc, eq, lt } from 'sdk/db';
import { chats, mediaUploadSessions, mediaUploadChunks } from '../schema.js';

export async function saveChat(ownerTgId, chat) {
  const now = new Date();
  await db.insert(chats).values({
    ownerTgId,
    chatId: chat.id,
    createdAt: now,
    title: chat.title || 'Untitled chat',
    username: chat.username || null,
    type: chat.type,
    photoFileId: chat.photo?.small_file_id || chat.photoFileId || null,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [chats.ownerTgId, chats.chatId],
    set: {
      title: chat.title || 'Untitled chat',
      username: chat.username || null,
      type: chat.type,
      photoFileId: chat.photo?.small_file_id || chat.photoFileId || null,
      updatedAt: now,
    },
  }).run();
}

export async function listSavedChats(ownerTgId) {
  const rows = await db.select().from(chats).where(eq(chats.ownerTgId, ownerTgId))
    .orderBy(desc(chats.updatedAt), asc(chats.title)).all();
  // Preserve the CloudStorage contract: frontend `id` is the Telegram chat ID.
  return rows.map((chat) => ({ ...chat, id: chat.chatId }));
}

export async function removeSavedChat(ownerTgId, chatId) {
  await db.delete(chats)
    .where(and(eq(chats.ownerTgId, ownerTgId), eq(chats.chatId, chatId)))
    .run();
}

export async function cleanupExpiredMediaUploads() {
  // timestamp-mode columns are stored as Unix seconds in SQLite. The
  // Serverless query binder rejects Date objects in comparison predicates,
  // so compare against a numeric timestamp rather than passing a Date.
  const cutoff = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
  const expired = await db.select({ uploadId: mediaUploadSessions.uploadId })
    .from(mediaUploadSessions).where(lt(mediaUploadSessions.createdAt, cutoff)).all();
  for (const session of expired) {
    await db.delete(mediaUploadChunks).where(eq(mediaUploadChunks.uploadId, session.uploadId)).run();
  }
  await db.delete(mediaUploadSessions).where(lt(mediaUploadSessions.createdAt, cutoff)).run();
  await db.delete(mediaUploadChunks).where(lt(mediaUploadChunks.createdAt, cutoff)).run();
}
