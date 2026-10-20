import { api, EndpointError, InputFile } from 'sdk';

const MAX_BYTES = 20 * 1024 * 1024;
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

const UPLOAD_SPEC = {
  photo: { method: 'sendPhoto', field: 'photo', readFileId: (m) => m.photo?.[m.photo.length - 1]?.file_id },
  video: { method: 'sendVideo', field: 'video', readFileId: (m) => m.video?.file_id },
  animation: { method: 'sendAnimation', field: 'animation', readFileId: (m) => m.animation?.file_id },
  audio: { method: 'sendAudio', field: 'audio', readFileId: (m) => m.audio?.file_id },
  document: { method: 'sendDocument', field: 'document', readFileId: (m) => m.document?.file_id },
  voice_note: { method: 'sendVoice', field: 'voice', readFileId: (m) => m.voice?.file_id }
};

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export default async function (input, ctx) {
  const user = ctx.initData?.user;
  if (!user?.id) {
    throw new EndpointError('Open this app from Telegram.', { code: 'TELEGRAM_AUTH_REQUIRED' });
  }

  const file = input?.file;
  const spec = UPLOAD_SPEC[input?.kind];
  if (!spec) throw new EndpointError('Unsupported media kind.', { code: 'UNSUPPORTED_MEDIA_KIND' });
  if (!file || typeof file.base64 !== 'string' || !file.base64) {
    throw new EndpointError('No file was provided.', { code: 'FILE_REQUIRED' });
  }

  let bytes;
  try {
    bytes = decodeBase64(file.base64);
  } catch {
    throw new EndpointError('The selected file could not be read.', { code: 'INVALID_FILE_DATA' });
  }

  if (bytes.byteLength > MAX_BYTES) {
    throw new EndpointError('Files must be 20 MB or smaller.', { code: 'FILE_TOO_LARGE' });
  }
  if (input.kind === 'photo' && bytes.byteLength > PHOTO_MAX_BYTES) {
    throw new EndpointError('Photos must be 10 MB or smaller. Try uploading it as a file instead.', {
      code: 'PHOTO_TOO_LARGE'
    });
  }

  try {
    const uploaded = await api[spec.method]({
      chat_id: user.id,
      [spec.field]: new InputFile(bytes, file.name || spec.field, {
        type: file.type || 'application/octet-stream'
      })
    });

    const fileId = spec.readFileId(uploaded);
    if (!fileId) throw new Error('Telegram did not return a file reference.');
    return { ok: true, file_id: fileId, message_id: uploaded.message_id };
  } catch (error) {
    if (error instanceof EndpointError) throw error;
    throw new EndpointError(error?.description || error?.message || 'Media upload failed.', {
      code: 'MEDIA_UPLOAD_FAILED'
    });
  }
}
