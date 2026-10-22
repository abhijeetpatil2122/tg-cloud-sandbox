import React from 'react'
import {
  Undo2, Redo2, Settings, Pilcrow, Heading, Code2, PanelBottom, Quote, TextQuote,
  MessageSquareQuote, List, ListOrdered, ListChecks, Image, Video, Clapperboard,
  Music2, FileText, Mic, LayoutGrid, GalleryHorizontal, Table, PanelBottomOpen,
  Sigma, MapPin, Minus, X, Send, Trash2, Plus, ChevronUp, ChevronDown, ChevronRight,
  Check, AlertCircle, Upload, LoaderCircle, Bold, Italic, Underline, Strikethrough,
  Code, Link2, Subscript, Superscript, Highlighter, EyeOff, RemoveFormatting, RefreshCw,
  SquareMousePointer, ExternalLink, AppWindow, AlignLeft, AlignCenter, AlignRight, Pencil,
  Ban, Forward, CornerDownLeft, Copy, Variable, Megaphone, Bot, Tag
} from 'lucide-react'

// Thin name -> Lucide-component lookup so the rest of the app keeps using
// <Icon name="..." /> without caring which library backs it.
const ICONS = {
  undo: Undo2,
  redo: Redo2,
  settings: Settings,
  paragraph: Pilcrow,
  heading: Heading,
  preformatted: Code2,
  footer: PanelBottom,
  quote: Quote,
  'quote-expand': TextQuote,
  pullquote: MessageSquareQuote,
  'list-bullet': List,
  'list-number': ListOrdered,
  'list-check': ListChecks,
  image: Image,
  video: Video,
  animation: Clapperboard,
  audio: Music2,
  document: FileText,
  voice_note: Mic,
  collage: LayoutGrid,
  slideshow: GalleryHorizontal,
  table: Table,
  details: PanelBottomOpen,
  math: Sigma,
  'inline-math': Variable,
  'about-channel': Megaphone,
  'about-developer': Code2,
  'about-bot': Bot,
  'about-version': Tag,
  map: MapPin,
  divider: Minus,
  spacing: Minus,
  close: X,
  send: Send,
  trash: Trash2,
  plus: Plus,
  minus: Minus,
  'chevron-up': ChevronUp,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  check: Check,
  error: AlertCircle,
  upload: Upload,
  spinner: LoaderCircle,
  bold: Bold,
  italic: Italic,
  underline: Underline,
  strikethrough: Strikethrough,
  code: Code,
  link: Link2,
  subscript: Subscript,
  superscript: Superscript,
  marked: Highlighter,
  spoiler: EyeOff,
  'clear-format': RemoveFormatting,
  swap: RefreshCw,
  buttons: SquareMousePointer,
  'action-url': ExternalLink,
  'action-web_app': AppWindow,
  'action-disabled': Ban,
  'action-switch_inline_query': Forward,
  'action-switch_inline_query_current_chat': CornerDownLeft,
  'action-copy_text': Copy,
  'align-left': AlignLeft,
  'align-center': AlignCenter,
  'align-right': AlignRight,
  edit: Pencil
}

export default function Icon({ name, size = 20, strokeWidth = 1.8, className = '', style }) {
  const Cmp = ICONS[name]
  if (!Cmp) return null
  return (
    <Cmp
      size={size}
      strokeWidth={strokeWidth}
      style={style}
      className={`icon icon-${name} ${name === 'spinner' ? 'icon-spin' : ''} ${className}`}
    />
  )
}
