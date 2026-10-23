import { api, EndpointError } from 'sdk';

function encodeBase64(input) {
  const bytes = input instanceof Uint8Array
    ? input
    : input instanceof ArrayBuffer
      ? new Uint8Array(input)
      : new Uint8Array(input || []);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const hasB = i + 1 < bytes.length;
    const hasC = i + 2 < bytes.length;
    const b = hasB ? bytes[i + 1] : 0;
    const c = hasC ? bytes[i + 2] : 0;
    output += alphabet[a >> 2];
    output += alphabet[((a & 3) << 4) | (b >> 4)];
    output += hasB ? alphabet[((b & 15) << 2) | (c >> 6)] : '=';
    output += hasC ? alphabet[c & 63] : '=';
  }
  return output;
}

export default async function (input, ctx) {
  if (!ctx.initData?.user?.id) {
    throw new EndpointError('Open this app from Telegram.', { code: 'TELEGRAM_AUTH_REQUIRED' });
  }
  const fileId = input?.file_id;
  if (typeof fileId !== 'string' || !fileId) {
    throw new EndpointError('A Telegram file ID is required.', { code: 'FILE_ID_REQUIRED' });
  }

  try {
    // getFileContent already performs getFile + the file download.
    const result = await api.getFileContent(fileId);
    const bytes = result instanceof Uint8Array
      ? result
      : result instanceof ArrayBuffer
        ? new Uint8Array(result)
        : new Uint8Array(result || []);

    if (!bytes.length) throw new Error('Telegram returned an empty file.');
    if (bytes.byteLength > 2 * 1024 * 1024) {
      throw new EndpointError('This file is too large to use as a chat avatar preview.', { code: 'PREVIEW_TOO_LARGE' });
    }
    return { ok: true, data_url: `data:image/jpeg;base64,${encodeBase64(bytes)}` };
  } catch (error) {
    if (error instanceof EndpointError) throw error;
    console.error('getMediaPreview failed', {
      message: error?.description || error?.message || String(error)
    });
    throw new EndpointError(error?.description || error?.message || 'Could not load this Telegram file.', {
      code: 'MEDIA_PREVIEW_FAILED'
    });
  }
}
