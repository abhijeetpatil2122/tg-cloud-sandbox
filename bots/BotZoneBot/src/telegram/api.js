import { getWebApp } from './webApp.js'

// Verification errors are shown directly in the Add channel/group form, so
// never leak transport status codes, internal error codes, or SDK diagnostics.
function friendlyVerificationError(error) {
  const code = String(
    error?.parameters?.code ||
    error?.code ||
    error?.type ||
    ''
  ).toUpperCase()
  const detail = String(
    error?.description ||
    error?.message ||
    error?.error ||
    ''
  )
    .replace(/^(?:Bad Request|Forbidden|Error):\s*/i, '')
    .replace(/\s*\(HTTP\s*\d+\)/gi, '')
    .trim()
  const message = detail.toLowerCase()

  if (code === 'TELEGRAM_AUTH_REQUIRED') {
    return 'Open this Mini App from Telegram and try again.'
  }
  if (code === 'CHAT_ID_REQUIRED') {
    return 'Enter a channel or group username or ID.'
  }
  if (code === 'CHAT_REFERENCE_INVALID') {
    return 'Enter a valid username (for example, @mychannel) or chat ID (for example, -100123456789). Links and invite links are not supported.'
  }
  if (code === 'UNSUPPORTED_CHAT_TYPE' || /private chat|unsupported chat type/.test(message)) {
    return 'Please enter a channel or group, not a private chat.'
  }
  if (/chat not found|chat_id_invalid|username.*invalid|invalid.*username|username.*not found/.test(message)) {
    return 'We couldn’t find that channel or group. Check the username or ID and try again.'
  }
  if (/bot must be an administrator|administrator in this channel|post messages permission|can.t post messages|not enough rights to send messages/.test(message)) {
    return 'The bot needs administrator permission to post in this channel. Check its channel permissions and try again.'
  }
  if (/bot must be a member|bot is not a member|not a member of the chat|user not found/.test(message)) {
    return 'Add the bot to that group or channel first, then try again.'
  }
  if (/restricted from sending|can.t send messages|write_forbidden/.test(message)) {
    return 'The bot does not have permission to send messages in that chat. Update its permissions and try again.'
  }
  if (/timed? out|timeout|network|temporarily unavailable|internal server error|serverless.*unavailable/.test(message)) {
    return 'The chat could not be checked right now. Please try again in a moment.'
  }

  // Allow only our own known, user-facing endpoint messages through. Unknown
  // strings can contain raw SDK errors, HTTP status codes, or internal details.
  const safePrefixes = [
    'Enter a ',
    'Enter a valid ',
    'Please enter ',
    'The bot needs ',
    'The bot does not have ',
    'Add the bot ',
    'Open this Mini App ',
    'We could not verify ',
    'We couldn’t find ',
    'The chat could not be checked '
  ]
  if (safePrefixes.some((prefix) => detail.startsWith(prefix))) {
    return detail.replace(/\bHTTP\s*\d+\b/gi, '').replace(/\s{2,}/g, ' ').trim()
  }

  return 'We could not verify that chat. Check the username or ID and try again.'
}

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
        if (error) {
          if (name === 'verifyChat') return reject(new Error(friendlyVerificationError(error)))
          const detail = error.message || 'Serverless request failed.'
          const code = error.parameters?.code || error.type
          const status = Number(error.status)
          const suffix = [
            code ? String(code) : '',
            Number.isFinite(status) && status > 0 ? `HTTP ${status}` : ''
          ].filter(Boolean).join(', ')
          return reject(new Error(suffix ? `${detail} (${suffix})` : detail))
        }
        if (result?.ok === false) {
          if (name === 'verifyChat') return reject(new Error(friendlyVerificationError(result)))
          return reject(new Error(result.error || result.message || 'Request failed.'))
        }
        resolve(result)
      })
    } catch (error) {
      if (settled) return
      settled = true
      cleanup()
      reject(name === 'verifyChat' ? new Error(friendlyVerificationError(error)) : (error instanceof Error ? error : new Error(String(error))))
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
