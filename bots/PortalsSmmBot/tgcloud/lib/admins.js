import { db } from 'sdk';
import { eq } from 'sdk/db';
import { OWNER_IDS, ADMIN_IDS } from './config.js';
import { botAdmins } from '../schema.js';

export function isOwner(userId) {
  return OWNER_IDS.includes(Number(userId));
}

export async function isAdmin(userId) {
  const id = Number(userId);
  if (!Number.isSafeInteger(id) || id <= 0) return false;
  if (isOwner(id) || ADMIN_IDS.includes(id)) return true;
  const row = await db.select().from(botAdmins).where(eq(botAdmins.userId, id)).get();
  return Boolean(row);
}

export async function listAdmins() {
  const rows = await db.select().from(botAdmins).all();
  const ids = new Set([...OWNER_IDS, ...ADMIN_IDS, ...rows.map(row => row.userId)]);
  return [...ids].sort((a, b) => a - b);
}

export async function addAdmin(userId, addedBy) {
  const id = Number(userId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Enter a valid numeric Telegram user ID.');
  if (isOwner(id) || ADMIN_IDS.includes(id)) return { added: false, reason: 'already_configured' };
  await db.insert(botAdmins).values({ userId: id, addedBy, createdAt: new Date() })
    .onConflictDoNothing().run();
  return { added: true };
}

export async function removeAdmin(userId) {
  const id = Number(userId);
  if (isOwner(id)) return { removed: false, reason: 'owner_protected' };
  if (ADMIN_IDS.includes(id)) return { removed: false, reason: 'config_protected' };
  await db.delete(botAdmins).where(eq(botAdmins.userId, id)).run();
  return { removed: true };
}
