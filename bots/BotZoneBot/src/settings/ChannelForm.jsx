import React, { useState } from 'react'
import { api } from '../telegram/api.js'
import { haptic } from '../telegram/webApp.js'

export default function ChannelForm({ onAdded }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit() {
    const id = value.trim()
    if (!id) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.verifyChannel(id)
      haptic('success')
      setValue('')
      setNotice('Chat verified and saved.')
      await onAdded()
    } catch (err) {
      haptic('error')
      setError(err.message || 'Could not verify that chat.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="channel-form">
      <input
        placeholder="@username or -100123456789"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      {error && <div className="form-error">{error}</div>}
      {notice && <div className="hint">{notice}</div>}
      <button className="add-btn" type="button" onClick={submit} disabled={busy || !value.trim()}>
        {busy ? 'Verifying…' : 'Verify and add'}
      </button>
      <div className="hint">
        The bot must already have permission to post in that chat. Saved chats are stored for your Telegram account.
      </div>
    </div>
  )
}
