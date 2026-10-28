import React from 'react'
import RichTextInput from './shared/RichTextInput.jsx'
import BlockList from '../BlockList.jsx'
import { useDocument } from '../../store/DocumentContext.jsx'
import { BLOCK } from '../../document/schema.js'

export default function BlockquoteBlock({ block, depth = 0, activeInputRef }) {
  const { updateBlock } = useDocument()
  const isExpandable = block.type === BLOCK.EXPANDABLE_BLOCKQUOTE

  return (
    <div className="blockquote-block">
      <div className="bar" />
      <div className="content">
        <RichTextInput
          html={block.html}
          onChange={(html) => updateBlock(block.id, { html })}
          placeholder="Quote"
          activeInputRef={activeInputRef}
        />
        {/* A normal quote can hold other blocks after its text. The collapsible
            quote can't — in the API it's flat text only (no `blocks`). */}
        {!isExpandable && (
          <BlockList blocks={block.children || []} depth={depth + 1} containerId={block.id} footer activeInputRef={activeInputRef} />
        )}
        {/* credit supports the same inline formatting as the quote itself — confirmed `credit?: RichText` in the API */}
        <RichTextInput
          html={block.creditHtml}
          multiline={false}
          onChange={(creditHtml) => updateBlock(block.id, { creditHtml })}
          placeholder="Credit (optional)"
          className="credit-input"
          activeInputRef={activeInputRef}
        />
        {isExpandable && <div className="expand-toggle">Shown collapsed in chat until the reader taps it</div>}
      </div>
    </div>
  )
}