import React, { useState } from 'react'
import { api } from '../telegram/api.js'
import { haptic } from '../telegram/webApp.js'

function validateChatReference(value) {
  const input = value.trim()
  if (!input) {
    return { error: 'Enter a channel or group username or ID.' }
  }

  // Telegram channel/group usernames are 5–32 characters, start with a
  // letter, and contain only letters, digits, and underscores.
  const username = input.replace(/^@/, '')
  if (/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username)) {
    return { value: `@${username}` }
  }

  // Numeric IDs for channels and groups are negative (including -100… IDs).
  if (/^-\d{1,20}$/.test(input)) {
    return { value: input }
  }

  return {
    error: 'Enter a valid channel or group username (for example, @mychannel) or numeric chat ID (for example, -100123456789). Links and invite links are not supported.'
  }
}

export default function ChannelForm({ onAdded }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit() {
    if (busy) return
    const validated = validateChatReference(value)
    if (validated.error) {
      setError(validated.error)
      setNotice('')
      haptic('error')
      return
    }

    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.verifyChannel(validated.value)
      haptic('success')
      setValue('')
      setNotice('Chat verified and saved.')
      await onAdded()
    } catch (err) {
      haptic('error')
      setError(err.message || 'We could not verify that chat. Check the username or ID and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="channel-form">
      <input
        placeholder="@username or -100123456789"
        aria-label="Channel or group username or ID"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setError('')
          setNotice('')
        }}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      {error && <div className="form-error" role="alert">{error}</div>}
      {notice && <div className="hint" role="status">{notice}</div>}
      <button className="add-btn" type="button" onClick={submit} disabled={busy || !value.trim()}>
        {busy ? 'Verifying…' : 'Verify and add'}
      </button>
      <div className="hint">
        Enter only a channel/group username or numeric ID. The bot must already have permission to post in that chat.
      </div>
    </div>
  )
}
