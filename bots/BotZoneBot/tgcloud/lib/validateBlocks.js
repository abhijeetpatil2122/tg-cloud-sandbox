// The client (src/document/richMessageBuilder.js) already builds the real
// Telegram `blocks` JSON. This is a defensive re-check on the server —
// reject anything malformed/oversized/disallowed before it reaches the
// Bot API, rather than trusting whatever the Mini App sent.

const RICH_TEXT_TYPES = new Set([
  'bold', 'italic', 'underline', 'strikethrough', 'code', 'url',
  'subscript', 'superscript', 'marked', 'spoiler',
  'mathematical_expression', // inline math — note: uses `expression`, not `text` (checked separately below)
  'button' // Rich Button — note: uses `button`, not `text` (checked separately below)
])

const BUTTON_STYLES = new Set(['primary', 'success', 'danger'])

const MEDIA_BLOCK_TYPES = new Set(['photo', 'video', 'animation', 'audio', 'document', 'voice_note'])

const BLOCK_TYPES = new Set([
  'paragraph', 'heading', 'pre', 'footer', 'list', 'blockquote',
  'expandable_blockquote', 'pullquote', 'table', 'details', 'divider',
  'mathematical_expression', 'map', 'collage', 'slideshow', 'buttons',
  ...MEDIA_BLOCK_TYPES
])

const BUTTON_ACTION_FIELDS = [
  'url', 'web_app', 'copy_text', 'disabled'
]

function checkRichMessageButton(button) {
  if (!button || typeof button !== 'object') throw new Error('Invalid button.')
  checkRichText(button.text)
  if (button.style !== undefined && !BUTTON_STYLES.has(button.style)) throw new Error('Invalid button style.')

  const actionFields = BUTTON_ACTION_FIELDS.filter((k) => button[k] !== undefined)
  if (actionFields.length !== 1) throw new Error('A button needs exactly one action.')

  // The client (ButtonEditorSheet) auto-prepends https:// to scheme-less
  // input before this is ever sent, but a direct API call might not —
  // still require a real scheme here rather than silently rewriting it.
  if (button.url !== undefined && (typeof button.url !== 'string' || !/^(https?:|tg:)\/\//i.test(button.url))) {
    throw new Error('Button URLs must use http(s):// or tg:// — e.g. https://t.me/your_channel.')
  }
  if (button.web_app !== undefined && (typeof button.web_app.url !== 'string' || !/^https:\/\//i.test(button.web_app.url))) {
    throw new Error('Button Mini App URLs must use https://.')
  }
  if (button.copy_text !== undefined && (typeof button.copy_text.text !== 'string' || !button.copy_text.text || button.copy_text.text.length > 256)) {
    throw new Error('Invalid copy_text.')
  }
  if (button.disabled !== undefined && typeof button.disabled !== 'object') {
    throw new Error('Invalid disabled button.')
  }
}

// Limits straight from the Bot API's rich-message docs: up to 500 blocks
// (counting nested blocks, list items and table rows), 16 levels of nesting,
// 50 media attachments, 20 table columns, 32768 characters of text.
const LIMITS = { blocks: 500, depth: 16, media: 50, columns: 20, chars: 32768 }

// Running totals for the message being validated. Validation is fully
// synchronous, so one module-level object (reset per call) is safe.
let stats = { blocks: 0, media: 0, chars: 0 }

function countBlocks(n) {
  stats.blocks += n
  if (stats.blocks > LIMITS.blocks) {
    throw new Error(`Too many blocks — Telegram allows ${LIMITS.blocks} in total (nested blocks, list items and table rows all count).`)
  }
}

function checkRichText(value, depth = 0) {
  if (depth > 12) throw new Error('Rich text is nested too deeply.')
  if (typeof value === 'string') {
    stats.chars += value.length
    return
  }
  if (Array.isArray(value)) {
    if (value.length > 200) throw new Error('A text block has too many parts.')
    value.forEach((v) => checkRichText(v, depth + 1))
    return
  }
  if (!value || typeof value !== 'object' || !RICH_TEXT_TYPES.has(value.type)) {
    throw new Error('Unsupported inline formatting.')
  }
  if (value.type === 'mathematical_expression') {
    if (typeof value.expression !== 'string' || !value.expression) {
      throw new Error('Invalid inline math expression.')
    }
    stats.chars += value.expression.length
    return
  }
  if (value.type === 'button') {
    return checkRichMessageButton(value.button)
  }
  checkRichText(value.text, depth + 1)
  if (value.type === 'url') {
    if (typeof value.url !== 'string' || !/^(https?:|tg:)\/\//i.test(value.url)) {
      throw new Error('Links must use http(s):// or tg:// URLs.')
    }
  }
}

function checkCaption(caption) {
  if (caption === undefined) return
  if (!caption || typeof caption !== 'object') throw new Error('Invalid caption.')
  checkRichText(caption.text)
  if (caption.credit !== undefined) checkRichText(caption.credit)
}

function checkMediaBlock(block) {
  const media = block[block.type]
  if (!media || typeof media.media !== 'string' || !media.media) {
    throw new Error(`Invalid ${block.type} block.`)
  }
  checkCaption(block.caption)
}

function checkBlock(block, depth = 0) {
  if (depth > LIMITS.depth) throw new Error(`Blocks are nested too deeply — Telegram allows ${LIMITS.depth} levels.`)
  if (!block || typeof block !== 'object' || !BLOCK_TYPES.has(block.type)) {
    throw new Error(`Unsupported block type: ${block?.type}`)
  }
  countBlocks(1)

  if (MEDIA_BLOCK_TYPES.has(block.type)) {
    stats.media += 1
    if (stats.media > LIMITS.media) throw new Error(`Too many media files — Telegram allows ${LIMITS.media} per message.`)
    return checkMediaBlock(block)
  }

  switch (block.type) {
    case 'paragraph':
    case 'footer':
      return checkRichText(block.text)
    case 'heading':
      if (!Number.isInteger(block.size) || block.size < 1 || block.size > 6) {
        throw new Error('Heading size must be 1-6.')
      }
      return checkRichText(block.text)
    case 'pre':
      if (typeof block.text !== 'string') throw new Error('Invalid code block.')
      stats.chars += block.text.length
      return
    case 'pullquote':
      checkRichText(block.text)
      if (block.credit !== undefined) checkRichText(block.credit)
      return
    case 'expandable_blockquote':
      checkRichText(block.text)
      if (block.credit !== undefined) checkRichText(block.credit)
      return
    case 'blockquote':
      if (!Array.isArray(block.blocks)) throw new Error('Invalid quote content.')
      block.blocks.forEach((b) => checkBlock(b, depth + 1))
      if (block.credit !== undefined) checkRichText(block.credit)
      return
    case 'list':
      if (!Array.isArray(block.items) || !block.items.length) throw new Error('Invalid list.')
      block.items.forEach((item) => {
        if (!Array.isArray(item.blocks) || !item.blocks.length) throw new Error('Invalid list item.')
        countBlocks(1) // each list item counts toward the 500-block limit
        item.blocks.forEach((b) => checkBlock(b, depth + 1))
      })
      return
    case 'table': {
      if (!Array.isArray(block.cells)) throw new Error('Invalid table.')
      block.cells.forEach((row) => {
        if (!Array.isArray(row)) throw new Error('Invalid table row.')
        if (row.length > LIMITS.columns) throw new Error(`Tables can have at most ${LIMITS.columns} columns.`)
        countBlocks(1) // each table row counts too
        row.forEach((cell) => {
          if (cell.text !== undefined) checkRichText(cell.text)
        })
      })
      if (block.caption !== undefined) checkRichText(block.caption)
      return
    }
    case 'details':
      checkRichText(block.summary)
      if (!Array.isArray(block.blocks)) throw new Error('Invalid details content.')
      block.blocks.forEach((b) => checkBlock(b, depth + 1))
      return
    case 'divider':
      return
    case 'mathematical_expression':
      if (typeof block.expression !== 'string' || !block.expression) throw new Error('Invalid math expression.')
      stats.chars += block.expression.length
      return
    case 'map':
      if (!block.location || typeof block.location.latitude !== 'number' || typeof block.location.longitude !== 'number') {
        throw new Error('Invalid map location.')
      }
      checkCaption(block.caption)
      return
    case 'collage':
    case 'slideshow':
      if (!Array.isArray(block.blocks) || !block.blocks.length) throw new Error(`Invalid ${block.type}.`)
      block.blocks.forEach((b) => checkBlock(b, depth + 1))
      checkCaption(block.caption)
      return
    case 'buttons':
      if (!Array.isArray(block.buttons) || !block.buttons.length || block.buttons.length > 20) {
        throw new Error('Invalid buttons block.')
      }
      block.buttons.forEach(checkRichMessageButton)
      if (block.align !== undefined && !['left', 'center', 'right'].includes(block.align)) {
        throw new Error('Invalid buttons alignment.')
      }
      return
  }
}

export function validateBlocks(blocks) {
  if (!Array.isArray(blocks) || !blocks.length) throw new Error('The message is empty.')
  stats = { blocks: 0, media: 0, chars: 0 }
  blocks.forEach((b) => checkBlock(b))
  if (stats.chars > LIMITS.chars) {
    throw new Error(`The message is too long — ${stats.chars} characters, Telegram allows ${LIMITS.chars}.`)
  }
  if (JSON.stringify(blocks).length > 1_000_000) throw new Error('The message is too large.')
  return blocks
}