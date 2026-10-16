import { db, EndpointError } from 'sdk';
import { demoNotes } from '../schema.js';

export default async function (input, ctx) {
  const user = ctx.initData?.user;
  if (!user?.id) {
    throw new EndpointError('Open this app from Telegram.', { code: 'TELEGRAM_AUTH_REQUIRED' });
  }

  const note = typeof input?.note === 'string' ? input.note.trim() : '';
  if (!note) {
    throw new EndpointError('Write a note before saving it.', { code: 'NOTE_REQUIRED' });
  }
  if (note.length > 200) {
    throw new EndpointError('Notes must be 200 characters or fewer.', { code: 'NOTE_TOO_LONG' });
  }

  await db.insert(demoNotes).values({ userId: user.id, note }).run();
  return { ok: true, saved: true };
}
