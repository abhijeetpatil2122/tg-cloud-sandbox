import React from 'react'
import RichTextInput from './shared/RichTextInput.jsx'
import BlockList from '../BlockList.jsx'
import { useDocument } from '../../store/DocumentContext.jsx'

export default function DetailsBlock({ block, depth = 0, activeInputRef }) {
  const { updateBlock } = useDocument()
  return (
    <div className="details-block">
      <div className="summary-row">
        <RichTextInput
          html={block.summaryHtml}
          multiline={false}
          onChange={(summaryHtml) => updateBlock(block.id, { summaryHtml })}
          placeholder="Summary (always shown)"
          activeInputRef={activeInputRef}
        />
        <button
          type="button"
          className={`open-toggle ${block.isOpen ? 'active' : ''}`}
          onClick={() => updateBlock(block.id, { isOpen: !block.isOpen })}
        >
          {block.isOpen ? 'Open by default' : 'Closed by default'}
        </button>
      </div>
      <div className="body">
        <RichTextInput
          html={block.bodyHtml}
          onChange={(bodyHtml) => updateBlock(block.id, { bodyHtml })}
          placeholder="Hidden content…"
          activeInputRef={activeInputRef}
        />
        <BlockList blocks={block.children || []} depth={depth + 1} containerId={block.id} footer activeInputRef={activeInputRef} />
      </div>
    </div>
  )
}