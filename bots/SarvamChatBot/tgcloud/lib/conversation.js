import { db } from 'sdk';
import { desc, eq } from 'sdk/db';
import { botSettings, conversationMessages } from '../schema.js';

const HISTORY_LIMIT = 16;

export async function getBotSettings() {
  return await db.select().from(botSettings).where(eq(botSettings.id, 1)).get();
}

export async function saveSarvamKey(userTgId, apiKey) {
  const current = await getBotSettings();

  if (!current) {
    await db.insert(botSettings).values({
      id: 1,
      ownerTgId: userTgId,
      sarvamApiKey: apiKey,
    }).run();
    return { ok: true, created: true };
  }

  if (Number(current.ownerTgId) !== Number(userTgId)) {
    return { ok: false, reason: 'not_owner' };
  }

  await db.update(botSettings)
    .set({ sarvamApiKey: apiKey })
    .where(eq(botSettings.id, 1))
    .run();

  return { ok: true, created: false };
}

export async function loadConversation(userTgId) {
  const rows = await db.select()
    .from(conversationMessages)
    .where(eq(conversationMessages.userTgId, userTgId))
    .orderBy(desc(conversationMessages.id))
    .limit(HISTORY_LIMIT)
    .all();

  return rows.reverse().map((row) => ({ role: row.role, content: row.content }));
}

export async function saveConversationTurn(userTgId, userText, assistantText) {
  const now = new Date();
  await db.insert(conversationMessages).values([
    { userTgId, role: 'user', content: userText, createdAt: now },
    { userTgId, role: 'assistant', content: assistantText, createdAt: now },
  ]).run();

  await db.run(
    'DELETE FROM conversation_messages WHERE user_tg_id = :user_id AND id NOT IN (SELECT id FROM conversation_messages WHERE user_tg_id = :user_id ORDER BY id DESC LIMIT 40)',
    { ':user_id': userTgId },
  );
}

export async function resetConversation(userTgId) {
  await db.delete(conversationMessages)
    .where(eq(conversationMessages.userTgId, userTgId))
    .run();
}
