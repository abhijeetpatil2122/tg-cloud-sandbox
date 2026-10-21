import { db, EndpointError } from 'sdk';
import { and, eq } from 'sdk/db';
import { mediaUploadChunks, mediaUploadSessions } from '../schema.js';

const CHUNK_BYTES = 32 * 1024;

function decodeBase64(value) {
  // Decode Base64URL without relying on atob(), which is not guaranteed to
  // exist in the Serverless V8 runtime. Also accept standard Base64 for older
  // clients and repair spaces produced if '+' was form-decoded upstream.
  let normalized = value.replace(/-/g, '+').replace(/_/g, '/').replace(/ /g, '+');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new Error('Unexpected character in base64 payload.');
  }
  normalized = normalized.replace(/=+$/, '');
  if (normalized.length % 4 === 1) throw new Error('Invalid base64 length.');
  normalized += '='.repeat((4 - normalized.length % 4) % 4);

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  const output = new Uint8Array((normalized.length / 4) * 3 - padding);
  let offset = 0;
  for (let i = 0; i < normalized.length; i += 4) {
    const a = alphabet.indexOf(normalized[i]);
    const b = alphabet.indexOf(normalized[i + 1]);
    const c = normalized[i + 2] === '=' ? 0 : alphabet.indexOf(normalized[i + 2]);
    const d = normalized[i + 3] === '=' ? 0 : alphabet.indexOf(normalized[i + 3]);
    if (a < 0 || b < 0 || c < 0 || d < 0) throw new Error('Invalid base64 alphabet.');
    if (offset < output.length) output[offset++] = (a << 2) | (b >> 4);
    if (normalized[i + 2] !== '=' && offset < output.length) output[offset++] = ((b & 15) << 4) | (c >> 2);
    if (normalized[i + 3] !== '=' && offset < output.length) output[offset++] = ((c & 3) << 6) | d;
  }
  return output;
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
