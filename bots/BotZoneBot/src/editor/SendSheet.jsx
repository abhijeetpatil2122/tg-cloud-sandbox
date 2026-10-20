import React, { useState } from 'react'
import BottomSheet from '../components/BottomSheet.jsx'
import Icon from '../components/Icon.jsx'
import { api } from '../telegram/api.js'
import TelegramFileImage from '../components/TelegramFileImage.jsx'
import { haptic } from '../telegram/webApp.js'

export default function SendSheet({ open, onClose, user, channels, blocks, onResult, onManageChannels }) {
  const [sendingId, setSendingId] = useState(null)

  async function send(target, label) {
    if (sendingId) return
    setSendingId(target.key)
    try {
      await api.sendRichMessage(blocks, target.payload)
      haptic('success')
      onClose()
      onResult({ type: 'success', message: `Sent to ${label}` })
    } catch (err) {
      haptic('error')
      onClose()
      onResult({ type: 'error', message: err.message || `Couldn't send to ${label}` })
    } finally {
      setSendingId(null)
    }
  }

  const initial = (user?.first_name || user?.username || '?').charAt(0).toUpperCase()

  return (
    <BottomSheet open={open} onClose={onClose} title="Send to">
      <div
        className="destination-row"
        onClick={() => send({ key: 'private', payload: { type: 'private' } }, 'Saved Messages')}
      >
        <div className="destination-avatar">
          {user?.photo_url ? <img src={user.photo_url} alt="" /> : initial}
        </div>
        <div className="destination-info">
          <div className="destination-title">{user?.first_name || 'You'} (preview)</div>
          <div className="destination-sub">Sends to your chat with the bot first</div>
        </div>
        <button
          className={`destination-send-btn ${sendingId === 'private' ? 'sent' : ''}`}
          type="button"
          disabled={!!sendingId}
        >
          {sendingId === 'private' ? '…' : <Icon name="send" size={13} />}
        </button>
      </div>

      {channels.length === 0 ? (
        <div className="sheet-empty">
          No channels saved yet.
          <div className="sheet-add-channel-link" onClick={onManageChannels}>
            Add a channel in Settings →
          </div>
        </div>
      ) : (
        channels.map((ch) => (
          <div
            key={ch.id}
            className="destination-row"
            onClick={() => send({ key: ch.id, payload: { type: 'channel', chat_id: ch.id } }, ch.title)}
          >
            <div className="destination-avatar">
              {ch.photoFileId ? <TelegramFileImage fileId={ch.photoFileId} alt="" /> : ch.title?.charAt(0)?.toUpperCase() || '#'}
            </div>
            <div className="destination-info">
              <div className="destination-title">{ch.title}</div>
              {ch.username && <div className="destination-sub">@{ch.username}</div>}
            </div>
            <button className={`destination-send-btn ${sendingId === ch.id ? 'sent' : ''}`} type="button" disabled={!!sendingId}>
              {sendingId === ch.id ? '…' : <Icon name="send" size={13} />}
            </button>
          </div>
        ))
      )}
    </BottomSheet>
  )
}
