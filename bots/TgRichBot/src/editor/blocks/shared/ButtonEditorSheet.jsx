import React, { useEffect, useState } from 'react'
import BottomSheet from '../../../components/BottomSheet.jsx'
import Icon from '../../../components/Icon.jsx'
import { BUTTON_STYLES, BUTTON_ACTION_TYPES, buttonNeedsDest } from '../../../document/schema.js'
import { normalizeUrl } from './urlUtils.js'

const DEST_LABEL = {
  url: 'URL',
  web_app: 'Mini App URL',
  copy_text: 'Text to copy'
}
const DEST_PLACEHOLDER = {
  url: 't.me/your_channel or example.com',
  web_app: 'https://example.com',
  copy_text: 'the text the button copies'
}
const ACTION_LABEL = {
  url: 'URL',
  web_app: 'Mini App',
  copy_text: 'Copy text',
  disabled: 'Disabled'
}
const ACTION_HINT = {
  disabled: 'Shows the button but it does nothing when tapped — useful as a label-only row item.',
}

// 'url' and 'web_app' are URL-shaped fields — scheme-less input gets https://
// prepended (see urlUtils.js) instead of being rejected.
function normalizeDest(actionType, raw) {
  return actionType === 'url' || actionType === 'web_app' ? normalizeUrl(raw) : raw.trim()
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
              onClick={() => setActionType(t)}
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