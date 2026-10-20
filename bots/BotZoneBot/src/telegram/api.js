import { getWebApp } from './webApp.js'

function call(name, input, { signal } = {}) {
  const serverless = getWebApp()?.Serverless
  if (!serverless?.call) return Promise.reject(new Error('Open this Mini App from Telegram to use its backend.'))

  return new Promise((resolve, reject) => {
    let settled = false
    const cleanup = () => signal?.removeEventListener('abort', onAbort)
    const onAbort = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new DOMException('Request cancelled.', 'AbortError'))
    }
    if (signal?.aborted) return onAbort()
    signal?.addEventListener('abort', onAbort, { once: true })

    try {
      serverless.call(name, input || {}, (error, result) => {
        if (settled) return
        settled = true
        cleanup()
        if (error) return reject(new Error(error.message || 'Serverless request failed.'))
        if (result?.ok === false) return reject(new Error(result.error || result.message || 'Request failed.'))
        resolve(result)
      })
    } catch (error) {
      if (settled) return
      settled = true
      cleanup()
      reject(error instanceof Error ? error : new Error(String(error)))
    }
  })
}

export const api = {
  verifyChannel: (channelId) => call('verifyChat', { chat_id: channelId }),
  listChannels: () => call('listChannels'),
  removeChannel: (chatId) => call('removeChannel', { chat_id: chatId }),
  beginMediaUpload: (metadata, signal) => call('beginMediaUpload', metadata, { signal }),
  uploadMediaChunk: (chunk, signal) => call('uploadMediaChunk', chunk, { signal }),
  finishMediaUpload: (uploadId, signal) => call('finishMediaUpload', { upload_id: uploadId }, { signal }),
  cancelMediaUpload: (uploadId) => call('cancelMediaUpload', { upload_id: uploadId }),
  sendRichMessage: (blocks, target) => call('sendRichMessage', { blocks, target }),
  getMediaPreview: (fileId) => call('getMediaPreview', { file_id: fileId })
}
