import { db } from 'sdk';
import { and, asc, desc, eq, lt } from 'sdk/db';
import {
  users, chats, shareRequests, mediaUploadSessions, mediaUploadChunks, mediaUploads, events
} from '../schema.js';

export async function upsertUser(user) {
  if (!user?.id) return;
  const now = new Date();
  await db.insert(users).values({
    tgId: user.id,
    firstName: user.first_name || null,
    lastName: user.last_name || null,
    username: user.username || null,
    lastSeen: now,
  }).onConflictDoUpdate({
    target: users.tgId,
    set: {
      firstName: user.first_name || null,
      lastName: user.last_name || null,
      username: user.username || null,
      lastSeen: now,
    },
  }).run();
}

export async function trackEvent(ownerTgId, eventType, { chatId = null, metadata = null } = {}) {
  await db.insert(events).values({ ownerTgId: ownerTgId ?? null, eventType, chatId, metadata }).run();
}

export async function saveChat(ownerTgId, chat, source = 'manual') {
  const now = new Date();
  await db.insert(chats).values({
    ownerTgId, chatId: chat.id, title: chat.title || 'Untitled chat',
    username: chat.username || null, type: chat.type,
    photoFileId: chat.photo?.small_file_id || chat.photoFileId || null,
    source, updatedAt: now,
  }).onConflictDoUpdate({
    target: [chats.ownerTgId, chats.chatId],
    set: {
      title: chat.title || 'Untitled chat', username: chat.username || null, type: chat.type,
      photoFileId: chat.photo?.small_file_id || chat.photoFileId || null, source, updatedAt: now,
    },
  }).run();
}

export async function listSavedChats(ownerTgId) {
  return db.select().from(chats).where(eq(chats.ownerTgId, ownerTgId))
    .orderBy(desc(chats.updatedAt), asc(chats.title)).all();
}

export async function removeSavedChat(ownerTgId, chatId) {
  await db.delete(chats).where(and(eq(chats.ownerTgId, ownerTgId), eq(chats.chatId, chatId))).run();
}

export async function createShareRequest(requestId, ownerTgId) {
  await db.insert(shareRequests).values({ requestId, ownerTgId }).run();
}

export async function consumeShareRequest(requestId, ownerTgId) {
  const request = await db.select().from(shareRequests)
    .where(and(eq(shareRequests.requestId, requestId), eq(shareRequests.ownerTgId, ownerTgId))).get();
  if (!request || request.consumedAt) return null;
  await db.update(shareRequests).set({ consumedAt: new Date() })
    .where(and(eq(shareRequests.requestId, requestId), eq(shareRequests.ownerTgId, ownerTgId))).run();
  return request;
}

export async function saveMediaUpload(ownerTgId, { fileId, kind, fileName, fileType, fileSize }) {
  await db.insert(mediaUploads).values({
    ownerTgId, fileId, kind, fileName: fileName || null, fileType: fileType || null, fileSize: fileSize ?? null,
  }).run();
}

export async function cleanupExpiredMediaUploads() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db.delete(mediaUploadChunks).where(lt(mediaUploadChunks.createdAt, cutoff)).run();
  await db.delete(mediaUploadSessions).where(lt(mediaUploadSessions.createdAt, cutoff)).run();
}
