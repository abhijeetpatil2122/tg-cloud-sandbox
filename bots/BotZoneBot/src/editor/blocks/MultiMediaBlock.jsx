import React, { useRef, useState } from 'react'
import Icon from '../../components/Icon.jsx'
import { useDocument } from '../../store/DocumentContext.jsx'
import { createMediaItem } from '../../document/schema.js'
import { uploadMediaFile, isCancelled } from './shared/useMediaUpload.js'

function Item({ item, onChange, onRemove }) {
  const inputRef = useRef(null)
  const [mode, setMode] = useState('add') // 'add' | 'url' | 'uploading' | 'filled'(implicit via item.source)
  const [urlDraft, setUrlDraft] = useState('')
  const attemptRef = useRef(0)
  const abortRef = useRef(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const myAttempt = ++attemptRef.current
    setMode('uploading')
    const kind = file.type.startsWith('video/') ? 'video' : 'photo'
    const { promise, abort } = uploadMediaFile(file, kind)
    abortRef.current = abort
    try {
      const { previewUrl, fileId } = await promise
      if (attemptRef.current !== myAttempt) return
      onChange({ kind, source: { mode: 'upload', previewUrl, fileId, status: 'ready' } })
    } catch (err) {
      if (attemptRef.current !== myAttempt) return
      setMode('add')
      if (!isCancelled(err)) window.alert(err.message)
    }
  }

  function cancelUpload() {
    attemptRef.current++
    abortRef.current?.()
    setMode('add')
  }

  function submitUrl() {
    const url = urlDraft.trim()
    if (!url) return setMode('add')
    const kind = /\.(mp4|webm|mov)(\?|$)/i.test(url) ? 'video' : 'photo'
    onChange({ kind, source: { mode: 'url', url } })
    setUrlDraft('')
  }

  if (item.source) {
    const src = item.source.mode === 'url' ? item.source.url : item.source.previewUrl
    return (
      <div className="multi-media-item">
        {item.kind === 'video' ? <video src={src} muted playsInline /> : <img src={src} alt="" />}
        <button type="button" className="remove" onClick={onRemove} aria-label="Remove">
          <Icon name="close" size={12} />
        </button>
      </div>
    )
  }

  if (mode === 'uploading') {
    return (
      <div className="multi-media-add uploading">
        <Icon name="spinner" size={16} />
        <button type="button" className="remove" onClick={cancelUpload} aria-label="Cancel upload">
          <Icon name="close" size={12} />
        </button>
      </div>
    )
  }

  if (mode === 'url') {
    return (
      <div className="multi-media-add url-entry">
        <input
          autoFocus
          placeholder="Image/video URL"
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitUrl()}
          onBlur={submitUrl}
        />
      </div>
    )
  }

  return (
    <div className="multi-media-add choices">
      <button type="button" onClick={() => inputRef.current?.click()} aria-label="Upload">
        <Icon name="upload" size={15} />
      </button>
      <button type="button" onClick={() => setMode('url')} aria-label="Paste URL">
        <Icon name="link" size={15} />
      </button>
      <input ref={inputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  )
}

export default function MultiMediaBlock({ block }) {
  const { updateBlock } = useDocument()

  function updateItem(id, patch) {
    updateBlock(block.id, { items: block.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })
  }

  function removeItem(id) {
    const items = block.items.filter((i) => i.id !== id)
    updateBlock(block.id, { items: items.length ? items : [createMediaItem('photo')] })
  }

  function addSlot() {
    updateBlock(block.id, { items: [...block.items, createMediaItem('photo')] })
  }

  const filled = block.items.filter((i) => i.source)
  const showAddSlot = block.items.length < 10 && filled.length === block.items.length

  return (
    <div className="multi-media-block">
      <div className="multi-media-grid">
        {block.items.map((item) => (
          <Item key={item.id} item={item} onChange={(patch) => updateItem(item.id, patch)} onRemove={() => removeItem(item.id)} />
        ))}
        {showAddSlot && (
          <button type="button" className="multi-media-add" onClick={addSlot} aria-label="Add another">
            <Icon name="plus" size={18} />
          </button>
        )}
      </div>
      <input
        className="media-caption-input"
        placeholder="Caption for the whole set (optional)"
        value={block.caption}
        onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
      />
    </div>
  )
}
