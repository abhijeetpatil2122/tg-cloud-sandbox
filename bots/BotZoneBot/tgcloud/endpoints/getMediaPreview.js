import { api, EndpointError } from 'sdk';

function mimeType(filePath = '') {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const types = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif' };
  return types[ext] || 'image/jpeg';
}

function encodeBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export default async function (input, ctx) {
  if (!ctx.initData?.user?.id) throw new EndpointError('Open this app from Telegram.', { code: 'TELEGRAM_AUTH_REQUIRED' });
  const fileId = input?.file_id;
  if (typeof fileId !== 'string' || !fileId) throw new EndpointError('A Telegram file ID is required.', { code: 'FILE_ID_REQUIRED' });

  try {
    const file = await api.getFile({ file_id: fileId });
    if (file.file_size && file.file_size > 2 * 1024 * 1024) {
      throw new EndpointError('This file is too large to use as a chat avatar preview.', { code: 'PREVIEW_TOO_LARGE' });
    }
    const bytes = await api.getFileContent(fileId);
    if (!(bytes instanceof Uint8Array) || !bytes.length) throw new Error('Telegram returned an empty file.');
    return { ok: true, data_url: `data:${mimeType(file.file_path)};base64,${encodeBase64(bytes)}` };
  } catch (error) {
    if (error instanceof EndpointError) throw error;
    console.error('getMediaPreview failed', { fileId, message: error?.message });
    throw new EndpointError(error?.description || error?.message || 'Could not load this Telegram file.', { code: 'MEDIA_PREVIEW_FAILED' });
  }
}
