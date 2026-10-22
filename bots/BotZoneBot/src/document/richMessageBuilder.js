// Turns our editor document (src/document/schema.js) into the `blocks`
// array Telegram's sendRichMessage expects (Bot API 10.1–10.3, "Rich
// Messages"). This runs entirely in the browser (uses DOMParser) — the
// finished JSON is what actually gets POSTed to /api/send, and the
// server only re-validates shape/size, it does not rebuild it.
//
// Every shape below (including RichBlockCaption's { text, credit? }, and
// expandable_blockquote's flat `text` field) was confirmed directly
// against the Bot API 10.3 TypeScript type definitions — nothing here is
// a guess anymore.
import { BLOCK, LIST_STYLE, plainText, buttonNeedsDest } from './schema.js'

const INLINE_TAG_TO_TYPE = {
  B: 'bold',
  STRONG: 'bold',
  I: 'italic',
  EM: 'italic',
  U: 'underline',
  S: 'strikethrough',
  STRIKE: 'strikethrough',
  CODE: 'code',
  SUB: 'subscript',
  SUP: 'superscript',
  MARK: 'marked'
}

/** { text, style, actionType, dest } -> a RichMessageButton (shared by the inline Rich Button span and the Buttons block). */
function buildRichMessageButton({ text, style, actionType, dest }) {
  const out = { text: text || '' }
  // 'default' is our own sentinel for "no style set" — the API has no
  // named neutral style, it's just the field being absent ("if omitted,
  // an app-specific style is used").
  if (style && style !== 'default') out.style = style

  switch (actionType) {
    case 'web_app':
      out.web_app = { url: dest || '' }
      break
    case 'switch_inline_query':
      out.switch_inline_query = dest || ''
      break
    case 'switch_inline_query_current_chat':
      out.switch_inline_query_current_chat = dest || ''
      break
    case 'copy_text':
      out.copy_text = { text: dest || '' }
      break
    case 'disabled':
      out.disabled = {}
      break
    case 'url':
    default:
      out.url = dest || ''
      break
  }
  return out
}

/** Recursively turn a DOM node into a Telegram RichText value (string | array | {type,text,...}). */
function nodeToRichText(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent
  if (node.nodeType !== Node.ELEMENT_NODE) return ''

  const tag = node.tagName

  // Rich Button is an "atomic" chip (contenteditable="false") whose real
  // content lives in data attributes, not its rendered children — check it
  // first so we never recurse into it for nothing.
  if (tag === 'SPAN' && node.getAttribute('data-rich-button') === 'true') {
    const button = buildRichMessageButton({
      text: node.textContent.trim(),
      style: node.getAttribute('data-style') || undefined,
      actionType: node.getAttribute('data-action-type'),
      dest: node.getAttribute('data-dest')
    })
    return { type: 'button', button }
  }

  const children = Array.from(node.childNodes).map(nodeToRichText).filter((v) => v !== '')
  const inner = children.length === 0 ? '' : children.length === 1 ? children[0] : children

  if (tag === 'A') {
    const href = node.getAttribute('href') || ''
    return { type: 'url', text: inner || href, url: href }
  }
  if (tag === 'SPAN' && node.getAttribute('data-spoiler') === 'true') {
    return { type: 'spoiler', text: inner }
  }
  const mark = INLINE_TAG_TO_TYPE[tag]
  if (mark) return { type: mark, text: inner }
  if (tag === 'BR') return '\n'
  return inner
}

/** Sanitized inline HTML (from RichTextInput) -> Telegram RichText union. */
export function htmlToRichText(html) {
  const clean = (html || '').trim()
  if (!clean) return ''
  const doc = new DOMParser().parseFromString(`<div>${clean}</div>`, 'text/html')
  const root = doc.body.firstChild
  const value = nodeToRichText(root)
  return value === '' ? '' : value
}

function paragraphFromHtml(html) {
  return { type: 'paragraph', text: htmlToRichText(html) }
}

function buildCaption(html) {
  const text = htmlToRichText(html)
  return text === '' ? undefined : { text }
}

/** Optional RichText field (credit lines) — undefined when empty, otherwise full inline formatting. */
function buildOptionalRichText(html) {
  if (!plainText(html).trim()) return undefined
  return htmlToRichText(html)
}

function buildListItem(item, style, index) {
  const out = { blocks: [paragraphFromHtml(item.html)] }
  if (style === LIST_STYLE.NUMBER) {
    out.type = '1'
    out.value = index + 1
  }
  if (style === LIST_STYLE.CHECKLIST) {
    out.has_checkbox = true
    out.is_checked = !!item.checked
  }
  return out
}

function buildTableCells(rows, align) {
  return rows.map((row) =>
    row.map((cell, colIndex) => {
      const out = { align: align[colIndex] || 'left', valign: 'middle' }
      const text = htmlToRichText(cell.text)
      if (text !== '') out.text = text
      if (cell.isHeader) out.is_header = true
      if (cell.colspan > 1) out.colspan = cell.colspan
      if (cell.rowspan > 1) out.rowspan = cell.rowspan
      return out
    })
  )
}

/** A media item (photo/video/animation/audio/document/voice_note) -> its InputRichBlock, or null if not yet uploaded/filled in. */
function buildMediaBlock(kind, source, captionHtml) {
  if (!source) return null
  const mediaValue = source.mode === 'upload' ? source.fileId : source.url
  if (!mediaValue) return null
  const out = { type: kind, [kind]: { type: kind, media: mediaValue } }
  const caption = buildCaption(captionHtml)
  if (caption) out.caption = caption
  return out
}

/** One editor block -> one Telegram block, or null if it has nothing to send yet. */
function buildBlock(block) {
  switch (block.type) {
    case BLOCK.PARAGRAPH:
      return paragraphFromHtml(block.html)

    case BLOCK.HEADING:
      return { type: 'heading', text: htmlToRichText(block.html), size: block.size }

    case BLOCK.PREFORMATTED: {
      const out = { type: 'pre', text: block.code }
      if (block.language && block.language !== 'plaintext') out.language = block.language
      return out
    }

    case BLOCK.FOOTER:
      return { type: 'footer', text: htmlToRichText(block.html) }

    case BLOCK.LIST:
      return {
        type: 'list',
        items: block.items
          .filter((i) => plainText(i.html).trim())
          .map((item, index) => buildListItem(item, block.style, index))
      }

    case BLOCK.BLOCKQUOTE: {
      const out = { type: 'blockquote', blocks: [paragraphFromHtml(block.html)] }
      const credit = buildOptionalRichText(block.creditHtml)
      if (credit !== undefined) out.credit = credit
      return out
    }

    case BLOCK.EXPANDABLE_BLOCKQUOTE: {
      // Unlike `blockquote`, this takes `text` directly (not nested
      // `blocks`) — and always renders collapsed until tapped.
      const out = { type: 'expandable_blockquote', text: htmlToRichText(block.html) }
      const credit = buildOptionalRichText(block.creditHtml)
      if (credit !== undefined) out.credit = credit
      return out
    }

    case BLOCK.PULLQUOTE: {
      const out = { type: 'pullquote', text: htmlToRichText(block.html) }
      const credit = buildOptionalRichText(block.creditHtml)
      if (credit !== undefined) out.credit = credit
      return out
    }

    case BLOCK.TABLE: {
      const out = { type: 'table', cells: buildTableCells(block.rows, block.align) }
      if (block.bordered) out.is_bordered = true
      if (block.striped) out.is_striped = true
      if (block.compact) out.is_compact = true
      const caption = buildOptionalRichText(block.caption)
      if (caption !== undefined) out.caption = caption
      return out
    }

    case BLOCK.DETAILS: {
      const bodyText = plainText(block.bodyHtml).trim()
      return {
        type: 'details',
        summary: htmlToRichText(block.summaryHtml),
        blocks: bodyText ? [paragraphFromHtml(block.bodyHtml)] : [],
        ...(block.isOpen ? { is_open: true } : {})
      }
    }

    case BLOCK.DIVIDER:
      return { type: 'divider' }

    case BLOCK.SPACING:
      // Editor-only spacing serializes as empty paragraph blocks.
      return Array.from({ length: Math.max(1, Math.min(8, Number(block.lines) || 1)) }, () => ({ type: 'paragraph', text: '' }))

    case BLOCK.MATH:
      return block.expression.trim() ? { type: 'mathematical_expression', expression: block.expression } : null

    case BLOCK.INLINE_MATH:
      // Same expression, but embedded in a paragraph's text rather than
      // standing alone as its own block — that placement is what makes
      // Telegram lay it out as left-aligned line text instead of a
      // centered display equation.
      return block.expression.trim()
        ? { type: 'paragraph', text: { type: 'mathematical_expression', expression: block.expression.trim() } }
        : null

    case BLOCK.MAP: {
      const lat = Number(block.latitude)
      const lon = Number(block.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
      const out = {
        type: 'map',
        location: { latitude: lat, longitude: lon },
        zoom: Number(block.zoom) || 14,
        width: Number(block.width) || 600,
        height: Number(block.height) || 300
      }
      const caption = buildCaption(block.caption)
      if (caption) out.caption = caption
      return out
    }

    case BLOCK.MEDIA:
      return buildMediaBlock(block.kind, block.source, block.caption)

    case BLOCK.MULTI_MEDIA: {
      const items = block.items.map((i) => buildMediaBlock(i.kind, i.source, '')).filter(Boolean)
      if (!items.length) return null
      const out = { type: block.layout, blocks: items }
      const caption = buildCaption(block.caption)
      if (caption) out.caption = caption
      return out
    }

    case BLOCK.BUTTONS: {
      const buttons = block.buttons
        .filter((b) => b.text.trim() && (!buttonNeedsDest(b.actionType) || b.dest.trim()))
        .map(buildRichMessageButton)
      if (!buttons.length) return null
      return { type: 'buttons', buttons, align: block.align }
    }

    default:
      return null
  }
}

/** Editor document -> { blocks } ready to send as InputRichMessage.blocks. */
export function buildRichMessageBlocks(doc) {
  return doc.blocks.flatMap((block) => {
    const result = buildBlock(block)
    return Array.isArray(result) ? result : result ? [result] : []
  })
}
