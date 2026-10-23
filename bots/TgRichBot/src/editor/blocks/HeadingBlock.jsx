import React from 'react'
import RichTextInput from './shared/RichTextInput.jsx'
import Icon from '../../components/Icon.jsx'
import { useDocument } from '../../store/DocumentContext.jsx'

export default function HeadingBlock({ block, activeInputRef }) {
  const { updateBlock } = useDocument()

  function cycleSize() {
    const next = block.size >= 6 ? 1 : block.size + 1
    updateBlock(block.id, { size: next })
  }

  return (
    <div className="heading-block" data-size={block.size}>
      <button className="heading-size-chip" onClick={cycleSize} type="button">
        H{block.size} <Icon name="chevron-right" size={12} />
      </button>
      <RichTextInput
        html={block.html}
        onChange={(html) => updateBlock(block.id, { html })}
        placeholder="Heading"
        activeInputRef={activeInputRef}
      />
    </div>
  )
}
