import React from 'react'
import Icon from '../components/Icon.jsx'
import ChannelForm from './ChannelForm.jsx'
import { removeChannel as removeChannelFromStorage } from '../telegram/channelStorage.js'
import TelegramFileImage from '../components/TelegramFileImage.jsx'
import { haptic, showPopup, openLink } from '../telegram/webApp.js'
import { APP_INFO } from './appInfo.js'

// Keep the original Settings layout: no extra empty-state banner or refresh button.
export default function SettingsScreen({ user, channels, onChannelsChanged }) {
  const initial = (user?.first_name || user?.username || '?').charAt(0).toUpperCase()

  async function removeChannel(channel) {
    const pressed = await showPopup({
      title: 'Remove channel',
      message: `Remove "${channel.title}" from your saved chats? You'll need to verify it again to add it back.`,
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
        <div className="name">
          {[user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'You'}
        </div>
        <div className="meta">
          {user?.username ? `@${user.username} · ` : ''}ID {user?.id ?? '—'}
        </div>
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
                  {ch.username ? `@${ch.username}` : ''}
                  {ch.username && ch.type ? ' · ' : ''}
                  {ch.type === 'channel' ? 'Channel' : ch.type === 'supergroup' ? 'Group' : ch.type === 'group' ? 'Group' : ''}
                </div>
              </div>
              <button className="icon-btn delete" type="button" onClick={() => removeChannel(ch)} aria-label="Remove">
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}
          <ChannelForm onAdded={onChannelsChanged} />
        </div>
      </div>

      <div className="settings-section">
      <div className="settings-section-title">About</div>
        <div className="about-pills">
          {APP_INFO.pills.map((pill) => {
            const Tag = pill.url ? 'button' : 'div'
            return (
              <Tag
                key={pill.id}
                className={`about-pill ${pill.url ? 'tappable' : ''}`}
                {...(pill.url ? { type: 'button', onClick: () => { haptic('light'); openLink(pill.url) } } : {})}
              >
                <Icon name={pill.icon} size={15} className="about-pill-icon" />
                <span className="about-pill-label">{pill.label}</span>
                {pill.value && <span className="about-pill-value">{pill.value}</span>}
                {pill.badge && <span className="about-badge">{pill.badge}</span>}
              </Tag>
            )
          })}
        </div>
      </div>
      </div>

      <div className="settings-footer-note">
        Rich Message Editor · Bot API 10.x Rich Messages
      </div>
    </div>
  )
}
