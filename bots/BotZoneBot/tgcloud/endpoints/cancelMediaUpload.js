import { db, EndpointError } from 'sdk';
import { and, eq } from 'sdk/db';
import { mediaUploadChunks, mediaUploadSessions } from '../schema.js';

export default async function (input, ctx) {
  const user = ctx.initData?.user;
  if (!user?.id) throw new EndpointError('Open this app from Telegram.', { code: 'TELEGRAM_AUTH_REQUIRED' });
  const uploadId = input?.upload_id;
  if (typeof uploadId !== 'string') return { ok: true };

  const session = await db.select().from(mediaUploadSessions)
    .where(and(eq(mediaUploadSessions.uploadId, uploadId), eq(mediaUploadSessions.ownerTgId, user.id))).get();
  if (!session) return { ok: true };

  await db.delete(mediaUploadChunks).where(eq(mediaUploadChunks.uploadId, uploadId)).run();
  await db.delete(mediaUploadSessions)
    .where(and(eq(mediaUploadSessions.uploadId, uploadId), eq(mediaUploadSessions.ownerTgId, user.id))).run();
  return { ok: true };
}
