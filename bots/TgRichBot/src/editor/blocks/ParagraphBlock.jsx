import React from 'react'
import RichTextInput from './shared/RichTextInput.jsx'
import { useDocument } from '../../store/DocumentContext.jsx'

export default function ParagraphBlock({ block, activeInputRef }) {
  const { updateBlock } = useDocument()
  return (
    <RichTextInput
      html={block.html}
      onChange={(html) => updateBlock(block.id, { html })}
      placeholder="Write something…"
      activeInputRef={activeInputRef}
    />
  )
}
