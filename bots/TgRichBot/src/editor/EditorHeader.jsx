import React from 'react'
import Icon from '../components/Icon.jsx'
import { useDocument } from '../store/DocumentContext.jsx'

export default function EditorHeader({ user, onOpenSettings }) {
  const { undo, redo, canUndo, canRedo } = useDocument()
  const initial = (user?.first_name || user?.username || '?').charAt(0).toUpperCase()

  return (
    <header className="editor-header">
      <div className="header-group">
        <button className="icon-btn" type="button" onClick={undo} disabled={!canUndo} aria-label="Undo">
          <Icon name="undo" size={20} />
        </button>
        <button className="icon-btn" type="button" onClick={redo} disabled={!canRedo} aria-label="Redo">
          <Icon name="redo" size={20} />
        </button>
      </div>
      <button className="avatar-btn" type="button" onClick={onOpenSettings} aria-label="Settings">
        {user?.photo_url ? <img src={user.photo_url} alt="" /> : initial}
      </button>
    </header>
  )
}
