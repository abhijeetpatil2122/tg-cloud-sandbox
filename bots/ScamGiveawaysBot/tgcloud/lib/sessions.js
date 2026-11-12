import { db } from 'sdk';
import { eq } from 'sdk/db';
import { reportDrafts } from '../schema.js';

export async function getDraft(userId) {
  return db.select().from(reportDrafts).where(eq(reportDrafts.userId, userId)).get();
}
export async function saveDraft(data) {
  return db.insert(reportDrafts).values(data).onConflictDoUpdate({
    target: reportDrafts.userId,
    set: {
      chatId: data.chatId, promptMessageId: data.promptMessageId, step: data.step,
      scammerHandle: data.scammerHandle ?? null, amount: data.amount ?? null,
      summary: data.summary ?? null, proofChannel: data.proofChannel ?? null,
      updatedAt: new Date(),
    },
  }).run();
}
export async function deleteDraft(userId) {
  return db.delete(reportDrafts).where(eq(reportDrafts.userId, userId)).run();
}
