import { api, db, EndpointError, InputFile } from 'sdk';
import { and, asc, eq } from 'sdk/db';
import { mediaUploadChunks, mediaUploadSessions } from '../schema.js';

const UPLOAD_METHODS = {
  photo: (params) => api.sendPhoto(params),
  video: (params) => api.sendVideo(params),
  animation: (params) => api.sendAnimation(params),
  audio: (params) => api.sendAudio(params),
  document: (params) => api.sendDocument(params),
  voice_note: (params) => api.sendVoice(params)
};

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
  if (typeof uploadId !== 'string') throw new EndpointError('Invalid upload session.', { code: 'INVALID_UPLOAD_ID' });

  const session = await db.select().from(mediaUploadSessions)
    .where(and(eq(mediaUploadSessions.uploadId, uploadId), eq(mediaUploadSessions.ownerTgId, user.id))).get();
  if (!session) throw new EndpointError('Upload session expired. Please try again.', { code: 'UPLOAD_SESSION_NOT_FOUND' });

  const chunks = await db.select().from(mediaUploadChunks)
    .where(eq(mediaUploadChunks.uploadId, uploadId))
    .orderBy(asc(mediaUploadChunks.chunkIndex)).all();
  if (chunks.length !== session.totalChunks || chunks.some((chunk, index) => chunk.chunkIndex !== index)) {
    throw new EndpointError('The upload is incomplete. Please retry the file.', { code: 'UPLOAD_INCOMPLETE' });
  }

  const bytes = new Uint8Array(session.fileSize);
  let offset = 0;
  for (const chunk of chunks) {
    const part = decodeBase64(chunk.base64);
    bytes.set(part, offset);
    offset += part.length;
  }
  if (offset !== session.fileSize) throw new EndpointError('Uploaded file size does not match.', { code: 'UPLOAD_SIZE_MISMATCH' });

  try {
    const method = UPLOAD_METHODS[session.kind];
    if (!method) throw new Error('Unsupported media type.');
    const field = session.kind === 'voice_note' ? 'voice' : session.kind;
    const message = await method({
      chat_id: user.id,
      [field]: new InputFile(bytes, session.fileName || session.kind, { type: session.fileType || 'application/octet-stream' })
    });
    const fileId = session.kind === 'photo'
      ? message.photo?.[message.photo.length - 1]?.file_id
      : message[field]?.file_id;
    if (!fileId) throw new Error('Telegram did not return a file reference.');

    await db.delete(mediaUploadChunks).where(eq(mediaUploadChunks.uploadId, uploadId)).run();
    await db.delete(mediaUploadSessions).where(eq(mediaUploadSessions.uploadId, uploadId)).run();
    return { ok: true, file_id: fileId, message_id: message.message_id };
  } catch (error) {
    if (error instanceof EndpointError) throw error;
    console.error('finishMediaUpload failed', { kind: session.kind, message: error?.message });
    throw new EndpointError(error?.description || error?.message || 'Media upload failed.', { code: 'MEDIA_UPLOAD_FAILED' });
  }
}
