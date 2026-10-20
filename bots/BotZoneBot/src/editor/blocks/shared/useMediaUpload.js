import { api } from '../../../telegram/api.js'

const CHUNK_BYTES = 512 * 1024

function bytesToBase64(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

async function fileChunkToBase64(file, signal) {
  if (signal?.aborted) throw new DOMException('Upload cancelled.', 'AbortError')
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (signal?.aborted) throw new DOMException('Upload cancelled.', 'AbortError')
  return bytesToBase64(bytes)
}

export const ACCEPT_BY_KIND = {
  photo: 'image/*',
  video: 'video/*',
  animation: 'image/gif,video/mp4',
  audio: 'audio/*',
  voice_note: 'audio/ogg,audio/*',
  document: '*/*'
}

// Upload small JSON chunks, avoiding a single large base64 request to Serverless.
export function uploadMediaFile(file, kind) {
  const controller = new AbortController()
  const previewUrl = /^(image|video)\//.test(file.type) ? URL.createObjectURL(file) : null
  const uploadId = globalThis.crypto?.randomUUID?.()
    || `up_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`

  const promise = (async () => {
    let started = false
    try {
      const totalChunks = Math.ceil(file.size / CHUNK_BYTES)
      await api.beginMediaUpload({
        upload_id: uploadId, kind, name: file.name || kind,
        type: file.type || 'application/octet-stream', size: file.size, total_chunks: totalChunks
      }, controller.signal)
      started = true

      for (let index = 0; index < totalChunks; index++) {
        if (controller.signal.aborted) throw new DOMException('Upload cancelled.', 'AbortError')
        const start = index * CHUNK_BYTES
        const end = Math.min(file.size, start + CHUNK_BYTES)
        const base64 = await fileChunkToBase64(file.slice(start, end), controller.signal)
        await api.uploadMediaChunk({ upload_id: uploadId, index, base64 }, controller.signal)
      }

      const { file_id: fileId } = await api.finishMediaUpload(uploadId, controller.signal)
      return { previewUrl, fileId, name: file.name }
    } catch (err) {
      if (started) api.cancelMediaUpload(uploadId).catch(() => {})
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      throw err
    }
  })()

  return { promise, abort: () => controller.abort() }
}

export function isCancelled(err) {
  return err?.name === 'AbortError'
}
