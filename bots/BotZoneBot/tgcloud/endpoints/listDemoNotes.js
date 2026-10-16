import { db } from 'sdk';
import { desc, eq } from 'sdk/db';
import { demoNotes } from '../schema.js';

export default async function (_input, ctx) {
  const user = ctx.initData?.user;
  if (!user?.id) return { notes: [] };

  const notes = await db.select({
    id: demoNotes.id,
    note: demoNotes.note,
    createdAt: demoNotes.createdAt,
  })
    .from(demoNotes)
    .where(eq(demoNotes.userId, user.id))
    .orderBy(desc(demoNotes.createdAt))
    .limit(10)
    .all();

  return { notes };
}
