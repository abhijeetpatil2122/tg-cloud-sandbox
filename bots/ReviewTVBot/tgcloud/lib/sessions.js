import { db } from 'sdk';
import { eq } from 'sdk/db';
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
