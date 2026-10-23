// Declarative toolbar config. Adding a block type to the toolbar is just
// adding an entry here — BlockToolbar.jsx renders whatever's in this list.
import { BLOCK, LIST_STYLE } from './schema.js'

export const TOOLBAR_CATEGORIES = [
  {
    id: 'text',
    label: 'Text',
    items: [
      { id: 'paragraph', icon: 'paragraph', label: 'Text', type: BLOCK.PARAGRAPH },
      { id: 'heading', icon: 'heading', label: 'Heading', type: BLOCK.HEADING, props: { size: 1 } },
      { id: 'preformatted', icon: 'preformatted', label: 'Code', type: BLOCK.PREFORMATTED },
      { id: 'footer', icon: 'footer', label: 'Footer', type: BLOCK.FOOTER }
    ]
  },
  {
    id: 'quote',
    label: 'Quotes',
    items: [
      { id: 'blockquote', icon: 'quote', label: 'Quote', type: BLOCK.BLOCKQUOTE },
      { id: 'expandable_blockquote', icon: 'quote-expand', label: 'Collapsible', type: BLOCK.EXPANDABLE_BLOCKQUOTE },
      { id: 'pullquote', icon: 'pullquote', label: 'Pull quote', type: BLOCK.PULLQUOTE }
    ]
  },
  {
    id: 'list',
    label: 'Lists',
    items: [
      { id: 'list-bullet', icon: 'list-bullet', label: 'Bulleted', type: BLOCK.LIST, props: { style: LIST_STYLE.BULLET } },
      { id: 'list-number', icon: 'list-number', label: 'Numbered', type: BLOCK.LIST, props: { style: LIST_STYLE.NUMBER } },
      { id: 'list-check', icon: 'list-check', label: 'Checklist', type: BLOCK.LIST, props: { style: LIST_STYLE.CHECKLIST } }
    ]
  },
  {
    id: 'media',
    label: 'Media',
    items: [
      { id: 'photo', icon: 'image', label: 'Photo', type: BLOCK.MEDIA, props: { kind: 'photo' } },
      { id: 'video', icon: 'video', label: 'Video', type: BLOCK.MEDIA, props: { kind: 'video' } },
      { id: 'animation', icon: 'animation', label: 'GIF', type: BLOCK.MEDIA, props: { kind: 'animation' } },
      { id: 'audio', icon: 'audio', label: 'Audio', type: BLOCK.MEDIA, props: { kind: 'audio' } },
      { id: 'voice_note', icon: 'voice_note', label: 'Voice', type: BLOCK.MEDIA, props: { kind: 'voice_note' } },
      { id: 'document', icon: 'document', label: 'File', type: BLOCK.MEDIA, props: { kind: 'document' } },
      { id: 'collage', icon: 'collage', label: 'Collage', type: BLOCK.MULTI_MEDIA, props: { layout: 'collage' } },
      { id: 'slideshow', icon: 'slideshow', label: 'Slideshow', type: BLOCK.MULTI_MEDIA, props: { layout: 'slideshow' } }
    ]
  },
  {
    id: 'layout',
    label: 'Layout',
    items: [
      { id: 'table', icon: 'table', label: 'Table', type: BLOCK.TABLE },
      { id: 'details', icon: 'details', label: 'Details', type: BLOCK.DETAILS },
      { id: 'map', icon: 'map', label: 'Map', type: BLOCK.MAP },
      // Two separate math blocks: 'Math' is centered like a display equation,
      // 'Inline math' sits in normal paragraph flow as one line of text.
      { id: 'math', icon: 'math', label: 'Math', type: BLOCK.MATH },
      { id: 'inline_math', icon: 'inline-math', label: 'Inline math', type: BLOCK.INLINE_MATH },
      { id: 'buttons', icon: 'buttons', label: 'Buttons', type: BLOCK.BUTTONS },
      { id: 'divider', icon: 'divider', label: 'Divider', type: BLOCK.DIVIDER },
      { id: 'spacing', icon: 'spacing', label: 'Spacing', type: BLOCK.SPACING, props: { lines: 1 } }
    ]
  }
]

/** Inline-formatting marks offered while a paragraph/heading/list-item is focused and text is selected. */
export const INLINE_MARKS = [
  { id: 'bold', icon: 'bold', tag: 'B' },
  { id: 'italic', icon: 'italic', tag: 'I' },
  { id: 'underline', icon: 'underline', tag: 'U' },
  { id: 'strikethrough', icon: 'strikethrough', tag: 'S' },
  { id: 'code', icon: 'code', tag: 'CODE' },
  { id: 'subscript', icon: 'subscript', tag: 'SUB' },
  { id: 'superscript', icon: 'superscript', tag: 'SUP' },
  { id: 'marked', icon: 'marked', tag: 'MARK' },
  { id: 'spoiler', icon: 'spoiler', tag: 'SPAN', attrs: { 'data-spoiler': 'true' } },
  { id: 'link', icon: 'link', tag: 'A', isLink: true },
  { id: 'rich_button', icon: 'buttons', isButton: true },
  { id: 'clear', icon: 'clear-format', isClear: true }
]