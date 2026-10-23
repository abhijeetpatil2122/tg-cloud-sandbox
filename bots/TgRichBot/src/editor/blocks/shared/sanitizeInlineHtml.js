const ALLOWED_TAGS = new Set([
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'CODE', 'A', 'BR', 'SUB', 'SUP', 'MARK', 'SPAN'
])

// Our three special-purpose SPAN markers (first entry in each list is the
// marker attribute that identifies the span's kind).
//
// - spoiler: a normal editable span (visually masked, but can contain
//   nested bold/italic/etc — so its children get recursively cleaned).
// - rich-button: an "atomic" chip — contenteditable="false" so
//   the caret can only sit before/after them, never inside (that's what
//   fixes the cursor-gets-stuck / typing-corrupts-the-chip class of bugs).
//   Its label is flattened to plain text on every sanitize pass (the API
//   only allows plain text inside a button).
const SPAN_ATTRS = {
  spoiler: ['data-spoiler'],
  // data-pending-id is temporary — present only while the ButtonEditorSheet
  // is open for this button (new OR an existing one being re-edited) — and
  // must survive sanitize until then (opening the sheet's inputs blurs
  // this field, which runs sanitize). Stripped once the sheet saves/cancels.
  'rich-button': ['data-rich-button', 'data-style', 'data-action-type', 'data-dest', 'data-pending-id']
}

function cleanSpan(node, out) {
  for (const [kind, attrs] of Object.entries(SPAN_ATTRS)) {
    const marker = attrs[0]
    if (node.getAttribute(marker) !== 'true') continue

    const el = document.createElement('SPAN')
    attrs.forEach((name) => {
      const value = node.getAttribute(name)
      if (value != null) el.setAttribute(name, value)
    })

    if (kind === 'rich-button') {
      el.setAttribute('contenteditable', 'false')
      el.textContent = node.textContent.replace(/\u200B/g, '')
    } else {
      node.childNodes.forEach((child) => cleanNode(child, el))
    }
    out.appendChild(el)
    return true
  }
  return false
}

function cleanNode(node, out) {
  if (node.nodeType === Node.TEXT_NODE) {
    // Strip zero-width spaces — these are only ever a transient caret
    // anchor inserted by RichTextInput after formatting/line-break
    // operations (see placeCaretAfterNode) and should never reach saved
    // content or the outgoing message.
    const text = node.textContent.replace(/\u200B/g, '')
    if (text) out.appendChild(document.createTextNode(text))
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return

  if (node.tagName === 'SPAN') {
    if (cleanSpan(node, out)) return
    // Not one of ours (paste junk — font/layout spans) — unwrap it.
    node.childNodes.forEach((child) => cleanNode(child, out))
    return
  }

  if (ALLOWED_TAGS.has(node.tagName)) {
    const el = document.createElement(node.tagName)
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') || ''
      if (/^(https?:|tg:)/i.test(href)) el.setAttribute('href', href)
    }
    node.childNodes.forEach((child) => cleanNode(child, el))
    out.appendChild(el)
    return
  }
  // Unknown wrapper (div/p from a browser's default Enter behavior, or
  // font/span junk from a paste) — keep its children, drop the wrapper
  // itself, but insert a line break first so content on its own line in
  // the source doesn't get silently glued onto the previous line.
  const blockLevel = node.tagName === 'DIV' || node.tagName === 'P'
  if (blockLevel && out.childNodes.length > 0) {
    out.appendChild(document.createElement('br'))
  }
  node.childNodes.forEach((child) => cleanNode(child, out))
}

/** Raw (possibly pasted, or Enter-mangled) HTML -> whitelisted inline HTML string. */
export function sanitizeInlineHtml(html) {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstChild
  const clean = document.createElement('div')
  root.childNodes.forEach((child) => cleanNode(child, clean))
  return clean.innerHTML
}