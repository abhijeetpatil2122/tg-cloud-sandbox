import React, { useEffect, useRef } from 'react'
import { sanitizeInlineHtml } from './sanitizeInlineHtml.js'

/**
 * A single formattable text field. Selection-based bold/italic/etc. are
 * applied by the parent editor via BlockToolbar, which finds the
 * currently-focused RichTextInput's DOM node through `activeInputRef`.
 *
 * Important: while the field is focused we NEVER reassign `innerHTML`.
 * Doing that mid-edit is what causes the cursor to jump to the start —
 * the browser has no way to know where your caret was inside content it
 * didn't just render itself. We only sanitize (strip anything outside our
 * tag whitelist) on blur and on paste, when there's no caret position left
 * to preserve.
 */
export default function RichTextInput({
  html,
  onChange,
  onFocus,
  onBlur,
  placeholder = 'Write something…',
  multiline = true,
  onEnterNext,
  onBackspaceEmpty,
  className = '',
  activeInputRef
}) {
  const ref = useRef(null)
  const isFocused = useRef(false)

  useEffect(() => {
    if (!ref.current || isFocused.current) return
    if (ref.current.innerHTML !== (html || '')) {
      ref.current.innerHTML = html || ''
    }
  }, [html])

  function insertLineBreak() {
    const selection = window.getSelection()
    if (!selection?.rangeCount) return
    const range = selection.getRangeAt(0)
    range.deleteContents()
    const br = document.createElement('br')
    range.insertNode(br)
    placeCaretAfterNode(selection, br)
    onChange?.(ref.current.innerHTML)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!multiline) {
        onChange?.(ref.current.innerHTML)
        onEnterNext?.()
      } else {
        insertLineBreak()
      }
      return
    }
    if (e.key === 'Backspace' && !multiline && !ref.current?.textContent?.length) {
      e.preventDefault()
      onBackspaceEmpty?.()
    }
  }

  function handlePaste(e) {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    onChange?.(ref.current.innerHTML)
  }

  return (
    <div
      ref={ref}
      className={`rich-input ${className}`}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={() => onChange?.(ref.current.innerHTML)}
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
      onFocus={(e) => {
        isFocused.current = true
        if (activeInputRef) activeInputRef.current = ref.current
        onFocus?.(e)
      }}
      onBlur={(e) => {
        isFocused.current = false
        const clean = sanitizeInlineHtml(ref.current.innerHTML)
        if (clean !== ref.current.innerHTML) ref.current.innerHTML = clean
        onChange?.(clean)
        onBlur?.(e)
      }}
    />
  )
}

/**
 * Places the caret right after `node` using a zero-width-space text node as
 * an anchor, instead of just "after the element" with nothing there. A bare
 * setStartAfter(el)/collapse(true) with no following text node is ambiguous
 * in most browsers' contenteditable implementations — typing right after
 * that keeps inheriting the formatting of the preceding element (the
 * "formatting keeps continuing" bug) and a trailing <br> with nothing after
 * it can fail to render a visible line. An explicit plain-text anchor fixes
 * both. The ZWSP is invisible and gets stripped on blur (sanitizeInlineHtml).
 */
function placeCaretAfterNode(selection, node) {
  const anchor = document.createTextNode('\u200B')
  node.parentNode.insertBefore(anchor, node.nextSibling)
  const range = document.createRange()
  range.setStart(anchor, 1)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

/** True if there's a non-collapsed text selection currently inside `container`. */
export function hasActiveSelection(container) {
  if (!container) return false
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false
  return container.contains(selection.getRangeAt(0).commonAncestorContainer)
}

/** Wraps the current selection (must be inside `container`) in `tagName`. Returns the new HTML, or null if there's no selection. */
export function applyInlineMark(container, tagName, attrs = {}) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!container.contains(range.commonAncestorContainer) || range.collapsed) return null

  const el = document.createElement(tagName)
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
  try {
    range.surroundContents(el)
  } catch {
    const contents = range.extractContents()
    el.appendChild(contents)
    range.insertNode(el)
  }

  // Anchor the caret just after the formatted element so typing continues
  // as plain text instead of inheriting bold/italic/etc.
  placeCaretAfterNode(selection, el)

  return sanitizeInlineHtml(container.innerHTML)
}

/**
 * Inserts a placeholder Rich Button span at the current selection (this
 * runs synchronously on tap, while the field is still focused and the
 * Selection/Range is still valid — see ButtonEditorSheet's usage for why
 * this can't wait until the sheet's own "Save" button is pressed: opening
 * the sheet and focusing its inputs blurs this field first, which runs
 * sanitize-on-blur and can invalidate a Range captured earlier). The span
 * is contenteditable="false" from the moment it's created — that's what
 * makes it an atomic chip the caret can sit next to but never inside (no
 * more "how do I get my cursor/typing out of the button" problem). Returns
 * the pending id to look the span back up by later, or null if there's
 * nowhere to insert it.
 */
export function insertRichButtonPlaceholder(container, text) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!container.contains(range.commonAncestorContainer)) return null

  const pendingId = `pb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  range.deleteContents()
  const el = document.createElement('SPAN')
  el.setAttribute('data-rich-button', 'true')
  el.setAttribute('data-pending-id', pendingId)
  el.setAttribute('data-style', '') // our 'default' (no style set) sentinel
  el.setAttribute('data-action-type', 'url')
  el.setAttribute('data-dest', '')
  el.setAttribute('contenteditable', 'false')
  el.textContent = text || 'Button'
  range.insertNode(el)
  placeCaretAfterNode(selection, el)
  return pendingId
}

/** Finds a pending Rich Button span anywhere in the editor canvas by its id. */
function findPendingButton(pendingId) {
  return document.querySelector(`span[data-pending-id="${pendingId}"]`)
}

/** Marks an *existing* Rich Button span as pending (so the sheet can edit it) without moving/recreating it. */
export function markButtonPending(span, pendingId) {
  span.setAttribute('data-pending-id', pendingId)
}

/** Fills in a pending Rich Button's real config and clears its pending marker, saving the change. */
export function finalizeRichButton(pendingId, { text, style, actionType, dest }) {
  const span = findPendingButton(pendingId)
  if (!span) return
  span.setAttribute('data-style', style === 'default' ? '' : style || '')
  span.setAttribute('data-action-type', actionType)
  span.setAttribute('data-dest', dest)
  span.removeAttribute('data-pending-id')
  span.textContent = text
  // The span itself now carries contenteditable="false", so searching for
  // "[contenteditable]" with no value would match the span before it ever
  // reaches the real editable container — this needs the exact "true" match.
  span.closest('[contenteditable="true"]')?.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Removes a pending Rich Button span entirely (used only for a freshly-inserted placeholder that was cancelled). */
export function cancelRichButton(pendingId) {
  const span = findPendingButton(pendingId)
  if (!span) return
  const container = span.closest('[contenteditable="true"]')
  span.remove()
  container?.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Clears an existing button's pending marker without deleting it (editing an existing button was cancelled). */
export function clearButtonPending(pendingId) {
  findPendingButton(pendingId)?.removeAttribute('data-pending-id')
}

/**
 * Strips all inline formatting from the current selection back to plain
 * text. Runs execCommand('removeFormat') first — the browser's own
 * built-in, battle-tested handling of the standard tags — then does a
 * manual plain-text replacement pass as well, since our custom tags
 * (sub/sup/mark/spoiler-span) aren't "standard formatting" as far as
 * execCommand is concerned and wouldn't otherwise be touched.
 */
export function clearInlineMarks(container) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!container.contains(range.commonAncestorContainer) || range.collapsed) return null

  try {
    document.execCommand('removeFormat')
  } catch {
    // Unsupported in this engine — the manual pass below still runs.
  }

  const current = window.getSelection()
  const liveRange = current?.rangeCount ? current.getRangeAt(0) : null
  if (!liveRange || liveRange.collapsed || !container.contains(liveRange.commonAncestorContainer)) {
    return sanitizeInlineHtml(container.innerHTML)
  }

  const text = liveRange.toString()
  liveRange.deleteContents()
  const node = document.createTextNode(text)
  liveRange.insertNode(node)

  placeCaretAfterNode(current, node)

  return sanitizeInlineHtml(container.innerHTML)
}