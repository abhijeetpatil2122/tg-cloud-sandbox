import { db } from 'sdk';
import { eq, sql } from 'sdk/db';
import { inlineUsageStats, inlineUsageUsers } from '../schema.js';

export async function recordInlineUsage(inlineQuery, isErrorMode) {
  const userId = inlineQuery.from?.id;

  await db.insert(inlineUsageStats).values({
    id: 1,
    totalQueries: 1,
    docsQueries: isErrorMode ? 0 : 1,
    errorQueries: isErrorMode ? 1 : 0,
  }).onConflictDoUpdate({
    target: inlineUsageStats.id,
    set: {
      totalQueries: sql`${inlineUsageStats.totalQueries} + 1`,
      docsQueries: sql`${inlineUsageStats.docsQueries} + ${isErrorMode ? 0 : 1}`,
      errorQueries: sql`${inlineUsageStats.errorQueries} + ${isErrorMode ? 1 : 0}`,
    },
  }).run();

  if (Number.isSafeInteger(userId)) {
    await db.insert(inlineUsageUsers).values({ userId }).onConflictDoUpdate({
      target: inlineUsageUsers.userId,
      set: { lastSeen: sql`(unixepoch())` },
    }).run();
  }
}

export async function getInlineUsageStats() {
  const [stats, uniqueUsers] = await Promise.all([
    db.select().from(inlineUsageStats).where(eq(inlineUsageStats.id, 1)).get(),
    db.$count(inlineUsageUsers),
  ]);

  return {
    totalQueries: stats?.totalQueries || 0,
    docsQueries: stats?.docsQueries || 0,
    errorQueries: stats?.errorQueries || 0,
    uniqueUsers,
  };
}
