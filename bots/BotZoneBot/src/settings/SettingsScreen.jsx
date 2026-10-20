import React from 'react'
import Icon from '../components/Icon.jsx'
import ChannelForm from './ChannelForm.jsx'
import { removeChannel as removeChannelFromStorage } from '../telegram/channelStorage.js'
import TelegramFileImage from '../components/TelegramFileImage.jsx'
import { haptic, showPopup } from '../telegram/webApp.js'

export default function SettingsScreen({ user, channels, onChannelsChanged }) {
  const initial = (user?.first_name || user?.username || '?').charAt(0).toUpperCase()

  async function removeChannel(channel) {
    const pressed = await showPopup({
      title: 'Remove channel',
      message: \`Remove "\${channel.title}" from your saved chats? This only removes it from the editor's list; it does not remove the bot from Telegram.\`,
      buttons: [
        { id: 'remove', type: 'destructive', text: 'Remove' },
        { id: 'cancel', type: 'cancel' }
      ]
    })
    if (pressed !== 'remove') return
    try {
      await removeChannelFromStorage(channel.id)
      haptic('success')
      onChannelsChanged()
    } catch (err) {
      haptic('error')
      window.alert(err.message)
    }
  }

  return (
    <div className="settings-screen">
      <div className="settings-profile">
        <div className="avatar-large">
          {user?.photo_url ? <img src={user.photo_url} alt="" /> : initial}
        </div>
        <div className="name">{[user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'You'}</div>
        <div className="meta">{user?.username ? \`@\${user.username} · \` : ''}ID {user?.id ?? '—'}</div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Saved chats for posting</div>
        <div className="settings-card">
          {channels.map((ch) => (
            <div className="channel-row" key={ch.id}>
              <div className="channel-avatar">
                {ch.photoFileId ? <TelegramFileImage fileId={ch.photoFileId} alt="" /> : ch.title?.charAt(0)?.toUpperCase() || '#'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="name">{ch.title}</div>
                <div className="username">
                  {ch.username ? \`@\${ch.username}\` : ''}
                  {ch.username && ch.type ? ' · ' : ''}
                  {ch.type === 'channel' ? 'Channel' : ch.type === 'supergroup' ? 'Group' : ch.type === 'group' ? 'Group' : ''}
                </div>
              </div>
              <button className="icon-btn delete" type="button" onClick={() => removeChannel(ch)} aria-label="Remove">
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}
          {channels.length === 0 && (
            <div className="hint" style={{ padding: '10px 12px' }}>No chats saved yet. Share a channel below to add it automatically.</div>
          )}
          <ChannelForm onAdded={onChannelsChanged} />
          <button className="add-btn" type="button" style={{ marginTop: 8 }} onClick={onChannelsChanged}>Refresh saved chats</button>
        </div>
      </div>

      <div className="settings-footer-note">Rich Message Editor · Bot API 10.x Rich Messages</div>
    </div>
  )
}
