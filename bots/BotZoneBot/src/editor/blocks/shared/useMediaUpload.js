import { api } from '../../../telegram/api.js'

const CHUNK_BYTES = 32 * 1024

// FileReader is more compatible with Telegram's embedded Android WebView than
// relying on Blob.arrayBuffer() being implemented consistently.
function fileChunkToBase64(blob, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Upload cancelled.', 'AbortError'))
      return
    }

    const reader = new FileReader()
    const cleanup = () => signal?.removeEventListener('abort', onAbort)
    const onAbort = () => {
      try { reader.abort() } catch {}
      cleanup()
      reject(new DOMException('Upload cancelled.', 'AbortError'))
    }

    reader.onload = () => {
      cleanup()
      const result = String(reader.result || '')
      const comma = result.indexOf(',')
      if (comma < 0) {
        reject(new Error('Could not read the selected file chunk.'))
        return
      }
      resolve(result.slice(comma + 1))
    }
    reader.onerror = () => {
      cleanup()
      reject(reader.error || new Error('Could not read the selected file chunk.'))
    }
    reader.onabort = () => {
      cleanup()
      reject(new DOMException('Upload cancelled.', 'AbortError'))
    }

    signal?.addEventListener('abort', onAbort, { once: true })
    reader.readAsDataURL(blob)
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

export function uploadMediaFile(file, kind) {
  const controller = new AbortController()
  const previewUrl = /^(image|video)\//.test(file.type) ? URL.createObjectURL(file) : null
  const uploadId = globalThis.crypto?.randomUUID?.()
    || `up_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`

  const promise = (async () => {
    let started = false
    let stage = 'starting upload session'
    try {
      if (!file.size) throw new Error('The selected file is empty.')
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
        stage = `reading chunk ${index + 1}/${totalChunks}`
        const base64 = await fileChunkToBase64(file.slice(start, end), controller.signal)
        stage = `sending chunk ${index + 1}/${totalChunks}`
        await api.uploadMediaChunk({ upload_id: uploadId, index, base64 }, controller.signal)
      }

      stage = 'finalizing the file with Telegram'
      const { file_id: fileId } = await api.finishMediaUpload(uploadId, controller.signal)
      if (!fileId) throw new Error('Telegram did not return a file reference.')
      return { previewUrl, fileId, name: file.name }
    } catch (err) {
      if (started) api.cancelMediaUpload(uploadId).catch(() => {})
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      if (isCancelled(err)) throw err
      const detail = err?.message || String(err)
      throw new Error(`${detail} (while ${stage})`)
    }
  })()

  return { promise, abort: () => controller.abort() }
}

export function isCancelled(err) {
  return err?.name === 'AbortError'
}
