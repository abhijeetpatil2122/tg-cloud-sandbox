import React, { useEffect, useState } from 'react'
import BottomSheet from '../../../components/BottomSheet.jsx'
import Icon from '../../../components/Icon.jsx'
import { BUTTON_STYLES, BUTTON_ACTION_TYPES, buttonNeedsDest } from '../../../document/schema.js'

const DEST_LABEL = {
  url: 'URL',
  web_app: 'Mini App URL',
  switch_inline_query: 'Pre-filled query (optional)',
  switch_inline_query_current_chat: 'Pre-filled query (optional)',
  copy_text: 'Text to copy',
  callback: 'Callback data'
}
const DEST_PLACEHOLDER = {
  url: 't.me/your_channel or example.com',
  web_app: 'your-app.vercel.app/...',
  switch_inline_query: 'leave blank to just open the chat picker',
  switch_inline_query_current_chat: 'leave blank to prefill nothing',
  copy_text: 'the text the button copies',
  callback: 'an identifier your bot reads back'
}
const ACTION_LABEL = {
  url: 'URL',
  web_app: 'Mini App',
  switch_inline_query: 'Share to chat',
  switch_inline_query_current_chat: 'Insert here',
  copy_text: 'Copy text',
  callback: 'Callback',
  disabled: 'Disabled'
}
const ACTION_HINT = {
  callback:
    "Needs your bot to handle this callback_data — not required just to post content. If you're not building that, URL or Mini App is usually what you want.",
  disabled: 'Shows the button but it does nothing when tapped — useful as a label-only row item.',
  switch_inline_query:
    'Opens Telegram\u2019s chat picker with your bot\u2019s inline mode pre-armed — needs your bot to support inline queries to show results.',
  switch_inline_query_current_chat: 'Same, but targets the chat the button is already in.'
}

// 'url' and 'web_app' are URL-shaped fields — if whatever's typed has no
// scheme at all (someone typed "t.me/..." or "example.com"), assume https
// rather than rejecting it. This is the actual fix for URLs that looked
// "wrong" once and then seemed to stay rejected even after being
// corrected: nothing used to normalize them, so a scheme-less value just
// round-tripped back out the same way it went in, every time.
function normalizeDest(actionType, raw) {
  const trimmed = raw.trim()
  if ((actionType === 'url' || actionType === 'web_app') && trimmed && !/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return `https://${trimmed}`
  }
  return trimmed
}

/**
 * Controlled by `open` + `initial` (a button config, or null to start
 * blank). Calling `onSave` with the finished config is the only way this
 * component reports back — it doesn't touch document state itself, so the
 * same sheet works for the inline mark, editing an existing inline button,
 * and the block-level Buttons row.
 */
export default function ButtonEditorSheet({ open, initial, onClose, onSave }) {
  const [text, setText] = useState('')
  const [style, setStyle] = useState('default')
  const [actionType, setActionType] = useState('url')
  const [dest, setDest] = useState('')

  useEffect(() => {
    if (!open) return
    setText(initial?.text || '')
    setStyle(initial?.style || 'default')
    setActionType(initial?.actionType || 'url')
    setDest(initial?.dest || '')
  }, [open, initial])

  const destRequired = buttonNeedsDest(actionType)
  const canSave = text.trim() && (!destRequired || dest.trim())

  function save() {
    if (!canSave) return
    onSave({ text: text.trim(), style, actionType, dest: normalizeDest(actionType, dest) })
  }

  function onFieldEnter(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      save()
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Button">
      <div className="button-editor">
        <label>Label</label>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onFieldEnter} placeholder="Button text" maxLength={64} />

        <label>Style</label>
        <div className="pill-row">
          {BUTTON_STYLES.map((s) => (
            <button
              key={s}
              type="button"
              className={`style-pill ${s} ${style === s ? 'active' : ''}`}
              disabled={s === 'link' && actionType !== 'callback'}
              onClick={() => setStyle(s)}
            >
              {s}
            </button>
          ))}
        </div>

        <label>Action</label>
        <div className="pill-row">
          {BUTTON_ACTION_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={`action-pill ${actionType === t ? 'active' : ''}`}
              onClick={() => {
                setActionType(t)
                if (t !== 'callback' && style === 'link') setStyle('default')
              }}
            >
              <Icon name={`action-${t}`} size={14} />
              {ACTION_LABEL[t]}
            </button>
          ))}
        </div>
        {ACTION_HINT[actionType] && <div className="field-hint">{ACTION_HINT[actionType]}</div>}

        {destRequired && (
          <>
            <label>{DEST_LABEL[actionType]}</label>
            <input value={dest} onChange={(e) => setDest(e.target.value)} onKeyDown={onFieldEnter} placeholder={DEST_PLACEHOLDER[actionType]} />
          </>
        )}

        <button type="button" className="add-btn" style={{ marginTop: 10 }} disabled={!canSave} onClick={save}>
          Save button
        </button>
      </div>
    </BottomSheet>
  )
}