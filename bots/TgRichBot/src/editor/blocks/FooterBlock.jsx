import React from 'react'
import RichTextInput from './shared/RichTextInput.jsx'
import { useDocument } from '../../store/DocumentContext.jsx'

export default function FooterBlock({ block, activeInputRef }) {
  const { updateBlock } = useDocument()
  return (
    <div className="footer-block">
      <RichTextInput
        html={block.html}
        onChange={(html) => updateBlock(block.id, { html })}
        placeholder="Footer note…"
        activeInputRef={activeInputRef}
      />
    </div>
  )
}
