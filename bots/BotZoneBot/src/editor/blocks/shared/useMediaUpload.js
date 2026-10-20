import { api } from '../../../telegram/api.js'

function fileToBase64(file, signal) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = reject
    reader.readAsDataURL(file)
    signal?.addEventListener('abort', () => {
      reader.abort()
      reject(new DOMException('Upload cancelled.', 'AbortError'))
    })
  })
}

export const ACCEPT_BY_KIND = {
  photo: 'image/*',
  video: 'video/*',
  animation: 'image/gif,video/mp4',
  audio: 'audio/*',
  voice_note: 'audio/ogg,audio/*',
  document: '*/*'
}

/**
 * Uploads a picked File to the user's own chat via the bot and resolves its
 * Telegram file_id. Returns { promise, abort } — call abort() to cancel a
 * upload in progress (e.g. the person tapped a cancel button, or started a
 * new upload before this one finished).
 */
export function uploadMediaFile(file, kind) {
  const controller = new AbortController()
  const previewUrl = /^(image|video)\//.test(file.type) ? URL.createObjectURL(file) : null

  const promise = (async () => {
    try {
      const base64 = await fileToBase64(file, controller.signal)
      const { file_id } = await api.uploadMedia({ name: file.name, type: file.type, base64 }, kind, controller.signal)
      return { previewUrl, fileId: file_id, name: file.name }
    } catch (err) {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      throw err
    }
  })()

  return { promise, abort: () => controller.abort() }
}

export function isCancelled(err) {
  return err?.name === 'AbortError'
}
