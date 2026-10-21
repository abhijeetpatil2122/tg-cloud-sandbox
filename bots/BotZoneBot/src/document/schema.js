// The editor's own document model. This is intentionally simpler/flatter
// than Telegram's real RichBlock union — richMessageBuilder.js is the only
// place that needs to know how to turn this into the real API payload.
// Adding a new block type = add a case here, a renderer in editor/blocks/,
// a toolbar entry in toolbarConfig.js, and a case in richMessageBuilder.js.

export const BLOCK = Object.freeze({
  PARAGRAPH: 'paragraph',
  HEADING: 'heading',
  PREFORMATTED: 'preformatted',
  FOOTER: 'footer',
  LIST: 'list',
  BLOCKQUOTE: 'blockquote',
  EXPANDABLE_BLOCKQUOTE: 'expandable_blockquote',
  PULLQUOTE: 'pullquote',
  TABLE: 'table',
  DETAILS: 'details',
  DIVIDER: 'divider',
  SPACING: 'spacing', // Editor-only vertical spacing; serialized as empty paragraphs.
  MATH: 'math',
  MAP: 'map',
  MEDIA: 'media',
  MULTI_MEDIA: 'multi_media', // collage or slideshow — see `layout` field
  BUTTONS: 'buttons'
})

// 'default' is OUR sentinel meaning "omit the style field" — the API has no
// named "normal/no-colour" style, it's just the absence of the field
// ("If omitted, then an app-specific style is used."). The other four are
// real API values. 'link' is only valid when actionType is 'callback'.
export const BUTTON_STYLES = ['default', 'primary', 'success', 'danger', 'link']

// Action types exposed in the UI. `login_url` and
// `switch_inline_query_chosen_chat` exist in the API too but are more
// niche/complex (OAuth-style auth, multi-field chat picker) — not added.
export const BUTTON_ACTION_TYPES = [
  'url',
  'web_app',
  'switch_inline_query',
  'switch_inline_query_current_chat',
  'copy_text',
  'callback',
  'disabled'
]

/** 'disabled' buttons (DisabledButton = {}) have no destination field — every other action type needs one. */
export const buttonNeedsDest = (actionType) => actionType !== 'disabled'

export const LIST_STYLE = Object.freeze({
  BULLET: 'bullet',
  NUMBER: 'number',
  CHECKLIST: 'checklist'
})

export const CODE_LANGUAGES = [
  'plaintext', 'javascript', 'typescript', 'python', 'java', 'kotlin', 'swift',
  'c', 'cpp', 'csharp', 'go', 'rust', 'php', 'ruby', 'sql', 'bash', 'json',
  'yaml', 'html', 'css'
]

let idCounter = 0
export function uid(prefix = 'b') {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`
}

/** Plain string / rich-run value stored as sanitized inline HTML (see RichTextInput). */
const emptyRich = () => ''

export function createMediaItem(kind = 'photo', overrides = {}) {
  return { id: uid('mi'), kind, source: null, ...overrides }
}

/** A single button — used both by the inline Rich Button span and the block-level Buttons row. */
export function createButtonConfig(overrides = {}) {
  return {
    id: uid('btn'),
    text: '',
    style: 'default',
    actionType: 'url',
    dest: '', // the url / callback_data / web_app url / switch-inline query / copy text, depending on actionType
    ...overrides
  }
}

export function createBlock(type, overrides = {}) {
  const id = uid(type)
  switch (type) {
    case BLOCK.PARAGRAPH:
      return { id, type, html: emptyRich(), ...overrides }
    case BLOCK.HEADING:
      return { id, type, html: emptyRich(), size: overrides.size || 1, ...overrides }
    case BLOCK.PREFORMATTED:
      return { id, type, code: '', language: overrides.language || 'plaintext', ...overrides }
    case BLOCK.FOOTER:
      return { id, type, html: emptyRich(), ...overrides }
    case BLOCK.LIST:
      return {
        id,
        type,
        style: overrides.style || LIST_STYLE.BULLET,
        items: overrides.items?.length
          ? overrides.items
          : [{ id: uid('li'), html: emptyRich(), checked: false }],
        ...overrides
      }
    case BLOCK.BLOCKQUOTE:
      return { id, type, html: emptyRich(), creditHtml: emptyRich(), ...overrides }
    case BLOCK.EXPANDABLE_BLOCKQUOTE:
      // Always renders collapsed-until-tapped — Telegram has no "default open" option for this one.
      return { id, type, html: emptyRich(), creditHtml: emptyRich(), ...overrides }
    case BLOCK.PULLQUOTE:
      return { id, type, html: emptyRich(), creditHtml: emptyRich(), ...overrides }
    case BLOCK.TABLE:
      return {
        id,
        type,
        bordered: true,
        striped: false,
        compact: false,
        caption: '',
        align: ['left', 'left'],
        rows:
          overrides.rows || [
            [
              { text: '', isHeader: true },
              { text: '', isHeader: true }
            ],
            [
              { text: '', isHeader: false },
              { text: '', isHeader: false }
            ]
          ],
        ...overrides
      }
    case BLOCK.DETAILS:
      return { id, type, summaryHtml: emptyRich(), bodyHtml: emptyRich(), isOpen: false, ...overrides }
    case BLOCK.DIVIDER:
      return { id, type }
    case BLOCK.SPACING:
      return { id, type, lines: Math.max(1, Math.min(8, Number(overrides.lines) || 1)) }
    case BLOCK.MATH:
      return { id, type, expression: '', ...overrides }
    case BLOCK.MAP:
      return { id, type, latitude: '', longitude: '', zoom: 14, width: 600, height: 300, caption: '', ...overrides }
    case BLOCK.MEDIA:
      return {
        id,
        type,
        kind: overrides.kind || 'photo', // photo | video | animation | audio | document | voice_note
        source: null, // { mode: 'url', url } | { mode: 'upload', previewUrl, fileId, status, name }
        caption: '',
        ...overrides
      }
    case BLOCK.MULTI_MEDIA:
      return {
        id,
        type,
        layout: overrides.layout || 'collage', // 'collage' | 'slideshow'
        items: overrides.items?.length ? overrides.items : [createMediaItem('photo'), createMediaItem('photo')],
        caption: '',
        ...overrides
      }
    case BLOCK.BUTTONS:
      return { id, type, align: overrides.align || 'left', buttons: overrides.buttons?.length ? overrides.buttons : [createButtonConfig()] }
    default:
      throw new Error(`Unknown block type: ${type}`)
  }
}

export function createInitialDocument() {
  return { blocks: [createBlock(BLOCK.PARAGRAPH)] }
}

export function isDocumentEmpty(doc) {
  if (!doc?.blocks?.length) return true
  return doc.blocks.every((b) => {
    switch (b.type) {
      case BLOCK.DIVIDER:
      case BLOCK.SPACING:
        return false
      case BLOCK.TABLE:
        return false
      case BLOCK.MEDIA:
        return !b.source
      case BLOCK.MULTI_MEDIA:
        return b.items.every((i) => !i.source)
      case BLOCK.BUTTONS:
        return b.buttons.every((btn) => !btn.text.trim() || (buttonNeedsDest(btn.actionType) && !btn.dest.trim()))
      case BLOCK.MAP:
        return !b.latitude || !b.longitude
      case BLOCK.MATH:
        return !b.expression.trim()
      case BLOCK.PREFORMATTED:
        return !b.code.trim()
      case BLOCK.DETAILS:
        return !plainText(b.summaryHtml).trim() && !plainText(b.bodyHtml).trim()
      case BLOCK.LIST:
        return b.items.every((i) => !plainText(i.html).trim())
      default:
        return !plainText(b.html).trim()
    }
  })
}

/** Strip HTML tags to get plain text length/content checks. */
export function plainText(html) {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '')
}
