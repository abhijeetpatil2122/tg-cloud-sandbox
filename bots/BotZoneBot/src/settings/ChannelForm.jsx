import React, { useState } from 'react'
import { api } from '../telegram/api.js'
import { haptic } from '../telegram/webApp.js'

export default function ChannelForm({ onAdded }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [sharing, setSharing] = useState(false)
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
      setNotice('Chat verified and saved to the bot database.')
      await onAdded()
    } catch (err) {
      haptic('error')
      setError(err.message || 'Could not verify that chat.')
    } finally {
      setBusy(false)
    }
  }

  async function shareChannel() {
    setSharing(true)
    setError('')
    setNotice('')
    try {
      const result = await api.requestChatShare()
      haptic('success')
      setNotice(result?.message || 'Open the bot chat and choose a channel.')
    } catch (err) {
      haptic('error')
      setError(err.message || 'Could not start channel sharing.')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="channel-form">
      <button className="add-btn" type="button" onClick={shareChannel} disabled={sharing}>
        {sharing ? 'Preparing…' : 'Share channel & add bot'}
      </button>
      <div className="hint">
        Telegram lets you select a channel and confirm the bot's posting permissions. The selected chat is saved automatically.
      </div>
      {notice && <div className="hint">{notice}</div>}
      <div className="row" style={{ alignItems: 'center', gap: 8, marginTop: 12 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--tg-theme-hint-color, #888)', opacity: 0.25 }} />
        <span style={{ fontSize: 12, color: 'var(--tg-theme-hint-color, #888)' }}>or add manually</span>
        <div style={{ flex: 1, height: 1, background: 'var(--tg-theme-hint-color, #888)', opacity: 0.25 }} />
      </div>
      <input
        placeholder="@username or -100123456789"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      {error && <div className="form-error">{error}</div>}
      <button className="add-btn" type="button" onClick={submit} disabled={busy || !value.trim()}>
        {busy ? 'Verifying…' : 'Verify and add'}
      </button>
      <div className="hint">
        Manual verification requires the bot to already have permission to post in that chat.
      </div>
    </div>
  )
}
