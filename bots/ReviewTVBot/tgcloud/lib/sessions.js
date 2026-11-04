import { db } from 'sdk';
import { and, eq, inArray, sql } from 'sdk/db';
import { reviewDrafts } from '../schema.js';

export async function getDraft(userId) {
  const row = await db.select().from(reviewDrafts).where(eq(reviewDrafts.userId, userId)).get();
  if (!row) return null;
  let data = {};
  try {
    data = JSON.parse(row.payload);
    if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
  } catch { data = {}; }
  return { ...row, data };
}

export async function saveDraft(userId, chatId, step, data) {
  const now = new Date();
  await db.insert(reviewDrafts).values({
    userId, chatId, step, payload: JSON.stringify(data ?? {}), createdAt: now, updatedAt: now,
  }).onConflictDoUpdate({
    target: reviewDrafts.userId,
    set: { chatId, step, payload: JSON.stringify(data ?? {}), updatedAt: now },
  }).run();
}

export async function deleteDraft(userId) {
  await db.delete(reviewDrafts).where(eq(reviewDrafts.userId, userId)).run();
}


// Append media with one atomic SQLite JSON update. Telegram sends each item in
// an album as a separate message update, and Serverless may run those handlers
// concurrently; a read/modify/write draft save would lose images under that race.
export async function appendDraftMedia(userId, chatId, items) {
  if (!Array.isArray(items) || !items.length) return false;
  let media = sql`COALESCE(json_extract(${reviewDrafts.payload}, '$.media'), '[]')`;
  for (const item of items) {
    media = sql`json_insert(${media}, '$[#]', json(${JSON.stringify(item)}))`;
  }
  const payload = sql`json_set(${reviewDrafts.payload}, '$.media', ${media}, '$.mediaMode', 'slideshow')`;
  const result = await db.update(reviewDrafts).set({
    payload,
    updatedAt: new Date(),
  }).where(and(
    eq(reviewDrafts.userId, userId),
    eq(reviewDrafts.chatId, chatId),
    inArray(reviewDrafts.step, ['media', 'edit_media']),
    sql`COALESCE(json_array_length(json_extract(${reviewDrafts.payload}, '$.media')), 0) + ${items.length} <= 10`,
  )).run();
  return Boolean(result.rowsAffected);
}


/**
 * Media appends are one small SQLite statement per photo; normal wizard steps
 * do not use that path. A stale publishing state is recovered by the handlers
 * after 2 minutes if Telegram's remote media fetch interrupted an invocation.
 */
