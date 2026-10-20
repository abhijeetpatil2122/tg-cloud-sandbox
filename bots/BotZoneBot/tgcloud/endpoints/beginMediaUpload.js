import { db, EndpointError } from 'sdk';
import { mediaUploadSessions } from '../schema.js';
import { cleanupExpiredMediaUploads } from '../lib/storage.js';

const MAX_BYTES = 20 * 1024 * 1024;
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
// Keep each request comfortably below Telegram Serverless payload limits.
const CHUNK_BYTES = 32 * 1024;
const KINDS = new Set(['photo', 'video', 'animation', 'audio', 'document', 'voice_note']);

export default async function (input, ctx) {
  const user = ctx.initData?.user;
  if (!user?.id) throw new EndpointError('Open this app from Telegram.', { code: 'TELEGRAM_AUTH_REQUIRED' });
  const uploadId = input?.upload_id;
  const kind = input?.kind;
  const size = Number(input?.size);
  const totalChunks = Number(input?.total_chunks);
  if (typeof uploadId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(uploadId)) {
    throw new EndpointError('Invalid upload session.', { code: 'INVALID_UPLOAD_ID' });
  }
  if (!KINDS.has(kind)) throw new EndpointError('Unsupported media type.', { code: 'UNSUPPORTED_MEDIA_KIND' });
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_BYTES) {
    throw new EndpointError('Files must be between 1 byte and 20 MB.', { code: 'FILE_SIZE_INVALID' });
  }
  if (kind === 'photo' && size > PHOTO_MAX_BYTES) {
    throw new EndpointError('Photos must be 10 MB or smaller. Try uploading it as a document instead.', { code: 'PHOTO_TOO_LARGE' });
  }
  if (!Number.isInteger(totalChunks) || totalChunks !== Math.ceil(size / CHUNK_BYTES)) {
    throw new EndpointError('Invalid upload chunk count.', { code: 'INVALID_CHUNK_COUNT' });
  }

  let stage = 'cleaning expired upload sessions';
  try {
    await cleanupExpiredMediaUploads();

    stage = 'creating upload session';
    await db.insert(mediaUploadSessions).values({
      uploadId, ownerTgId: user.id, kind, fileName: String(input?.name || kind).slice(0, 255),
      fileType: String(input?.type || 'application/octet-stream').slice(0, 120),
      fileSize: size, totalChunks, createdAt: new Date()
    }).run();
    return { ok: true, chunk_bytes: CHUNK_BYTES, total_chunks: totalChunks };
  } catch (error) {
    console.error('beginMediaUpload failed', {
      stage,
      code: error?.code || error?.cause?.code || null,
      message: error?.message || String(error)
    });
    if (error instanceof EndpointError) throw error;
    throw new EndpointError(
      `Could not initialize upload session while ${stage}. ${error?.message || 'Database operation failed.'}`,
      { code: 'UPLOAD_SESSION_INIT_FAILED' }
    );
  }
}
