import { db } from 'sdk';
import { eq } from 'sdk/db';
import { reportDrafts, adminSessions, botSettings } from '../schema.js';

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
export async function getAdminSession(userId) {
  return db.select().from(adminSessions).where(eq(adminSessions.userId, userId)).get();
}
export async function saveAdminSession(data) {
  return db.insert(adminSessions).values(data).onConflictDoUpdate({
    target: adminSessions.userId,
    set: { chatId: data.chatId, promptMessageId: data.promptMessageId, step: data.step, updatedAt: new Date() },
  }).run();
}
export async function deleteAdminSession(userId) {
  return db.delete(adminSessions).where(eq(adminSessions.userId, userId)).run();
}
export async function getSetting(key) {
  const row = await db.select().from(botSettings).where(eq(botSettings.key, key)).get();
  return row?.value ?? null;
}
export async function setSetting(key, value) {
  return db.insert(botSettings).values({ key, value: String(value), updatedAt: new Date() }).onConflictDoUpdate({
    target: botSettings.key,
    set: { value: String(value), updatedAt: new Date() },
  }).run();
}
