import { db, EndpointError } from 'sdk';
import { and, eq } from 'sdk/db';
import { mediaUploadChunks, mediaUploadSessions } from '../schema.js';

const CHUNK_BYTES = 512 * 1024;

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export default async function (input, ctx) {
  const user = ctx.initData?.user;
  if (!user?.id) throw new EndpointError('Open this app from Telegram.', { code: 'TELEGRAM_AUTH_REQUIRED' });
  const uploadId = input?.upload_id;
  const index = Number(input?.index);
  const base64 = input?.base64;
  if (typeof uploadId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(uploadId)) {
    throw new EndpointError('Invalid upload session.', { code: 'INVALID_UPLOAD_ID' });
  }
  if (!Number.isInteger(index) || index < 0 || typeof base64 !== 'string' || !base64) {
    throw new EndpointError('Invalid upload chunk.', { code: 'INVALID_CHUNK' });
  }
  const session = await db.select().from(mediaUploadSessions)
    .where(and(eq(mediaUploadSessions.uploadId, uploadId), eq(mediaUploadSessions.ownerTgId, user.id))).get();
  if (!session) throw new EndpointError('Upload session expired. Please try again.', { code: 'UPLOAD_SESSION_NOT_FOUND' });
  if (index >= session.totalChunks) throw new EndpointError('Chunk index is out of range.', { code: 'CHUNK_INDEX_INVALID' });
  if (base64.length > Math.ceil(CHUNK_BYTES / 3) * 4 + 8) {
    throw new EndpointError('Upload chunk is too large.', { code: 'CHUNK_TOO_LARGE' });
  }

  let bytes;
  try { bytes = decodeBase64(base64); }
  catch { throw new EndpointError('Invalid upload chunk encoding.', { code: 'CHUNK_ENCODING_INVALID' }); }
  const expectedSize = Math.min(CHUNK_BYTES, session.fileSize - index * CHUNK_BYTES);
  if (bytes.byteLength !== expectedSize) {
    throw new EndpointError('Upload chunk size did not match the expected size.', { code: 'CHUNK_SIZE_MISMATCH' });
  }

  await db.insert(mediaUploadChunks).values({ uploadId, chunkIndex: index, base64, createdAt: new Date() })
    .onConflictDoUpdate({
      target: [mediaUploadChunks.uploadId, mediaUploadChunks.chunkIndex],
      set: { base64, createdAt: new Date() }
    }).run();
  return { ok: true, index };
}
