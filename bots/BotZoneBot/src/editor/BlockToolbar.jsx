import React, { useEffect, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { useDocument } from '../store/DocumentContext.jsx'
import { TOOLBAR_CATEGORIES, INLINE_MARKS } from '../document/toolbarConfig.js'
import { BLOCK, createButtonConfig } from '../document/schema.js'
import {
  applyInlineMark,
  clearInlineMarks,
  hasActiveSelection,
  insertInlineMath,
  insertRichButtonPlaceholder,
  markButtonPending,
  finalizeRichButton,
  cancelRichButton,
  clearButtonPending
} from './blocks/shared/RichTextInput.jsx'
import ButtonEditorSheet from './blocks/shared/ButtonEditorSheet.jsx'

export default function BlockToolbar({ activeInputRef, lastBlockId }) {
  const { doc, addBlock, updateBlock } = useDocument()
  const [selectionActive, setSelectionActive] = useState(false)
  // { pendingId, initial, isNew } | null — isNew decides whether Cancel
  // deletes the span (a fresh insert) or just leaves an existing one alone.
  const [buttonSheet, setButtonSheet] = useState(null)

  useEffect(() => {
    function onSelectionChange() {
      setSelectionActive(hasActiveSelection(activeInputRef.current))
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [activeInputRef])

  // Tapping an *existing* inline Rich Button (they're contenteditable=false
  // chips, not normal editable text) opens the same editor to correct it —
  // previously there was no way to fix one once placed.
  useEffect(() => {
    function onClick(e) {
      const span = e.target.closest?.('span[data-rich-button="true"]')
      if (!span) return
      e.preventDefault()
      const pendingId = `edit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      markButtonPending(span, pendingId)
      setButtonSheet({
        pendingId,
        isNew: false,
        initial: {
          text: span.textContent,
          style: span.getAttribute('data-style') || 'default',
          actionType: span.getAttribute('data-action-type') || 'url',
          dest: span.getAttribute('data-dest') || ''
        }
      })
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  function handleMark(mark) {
    const el = activeInputRef.current
    // Every inline mark, Rich Button included, needs an actual selection —
    // there's nothing to turn into a button/bold/etc. otherwise.
    if (!el || !hasActiveSelection(el)) return

    if (mark.isButton) {
      const label = window.getSelection()?.toString() || ''
      const pendingId = insertRichButtonPlaceholder(el, label)
      if (!pendingId) return
      notifyChanged(el)
      setButtonSheet({ pendingId, isNew: true, initial: { text: label, style: 'default', actionType: 'url', dest: '' } })
      return
    }
    if (mark.isClear) {
      if (clearInlineMarks(el) !== null) notifyChanged(el)
      return
    }
    if (mark.isLink) {
      const url = window.prompt('Link URL')
      if (!url) return
      if (applyInlineMark(el, 'A', { href: url }) !== null) notifyChanged(el)
      return
    }
    if (applyInlineMark(el, mark.tag, mark.attrs) !== null) notifyChanged(el)
  }

  // applyInlineMark/clearInlineMarks mutate the DOM directly via the Range
  // API, which doesn't fire a React input event — dispatch one so the
  // owning RichTextInput re-reads innerHTML and saves it.
  function notifyChanged(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }))
    setSelectionActive(false)
  }

  function handleInsert(item) {
    const el = activeInputRef.current
    const selected = hasActiveSelection(el)

    // Math is dual-purpose: with text selected, convert it to inline math
    // right where it is; with nothing selected, insert a new (centered)
    // Math block instead. Both variants live behind this one toolbar item.
    if (item.id === 'math' && selected) {
      if (insertInlineMath(el) !== null) notifyChanged(el)
      return
    }

    // Repeated taps of "Buttons" used to each create a brand new block —
    // if one row already exists right here, add to it instead, so the
    // whole row keeps one consistent alignment rather than ending up as
    // several separate rows each defaulting back to left-aligned.
    if (item.id === 'buttons') {
      const anchorBlock = doc.blocks.find((b) => b.id === lastBlockId)
      if (anchorBlock?.type === BLOCK.BUTTONS) {
        updateBlock(anchorBlock.id, { buttons: [...anchorBlock.buttons, createButtonConfig()] })
        return
      }
    }

    addBlock(item.type, item.props || {}, lastBlockId)
  }

  return (
    <div className="block-toolbar">
      <div className="inline-marks-row">
        {INLINE_MARKS.map((mark) => (
          <button
            key={mark.id}
            className="icon-btn"
            type="button"
            disabled={!selectionActive}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleMark(mark)}
          >
            <Icon name={mark.icon} size={17} />
          </button>
        ))}
      </div>
      <div className="toolbar-scroll">
        {TOOLBAR_CATEGORIES.map((category, i) => (
          <React.Fragment key={category.id}>
            {i > 0 && <span className="toolbar-divider" />}
            <div className="toolbar-items">
              {category.items.map((item) => (
                <button key={item.id} className="toolbar-item" type="button" onClick={() => handleInsert(item)}>
                  <span className="icon-circle">
                    <Icon name={item.icon} size={17} />
                  </span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </React.Fragment>
        ))}
      </div>

      <ButtonEditorSheet
        open={!!buttonSheet}
        initial={buttonSheet?.initial}
        onClose={() => {
          if (buttonSheet) {
            if (buttonSheet.isNew) cancelRichButton(buttonSheet.pendingId)
            else clearButtonPending(buttonSheet.pendingId)
          }
          setButtonSheet(null)
        }}
        onSave={(config) => {
          if (buttonSheet) finalizeRichButton(buttonSheet.pendingId, config)
          setButtonSheet(null)
        }}
      />
    </div>
  )
}