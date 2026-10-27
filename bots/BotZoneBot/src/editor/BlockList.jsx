import React, { useState } from 'react'
import Icon from '../components/Icon.jsx'
import BlockRenderer from './BlockRenderer.jsx'
import AddBlockSheet from './AddBlockSheet.jsx'
import { useDocument } from '../store/DocumentContext.jsx'
import { MAX_NEST_DEPTH } from '../document/schema.js'

/**
 * Renders one sibling array of blocks — the whole document at the top level
 * (depth 0), or the nested blocks inside a quote / list item / details block.
 * `footer` adds the "+ Add block inside" control for containers; it's hidden
 * once nesting reaches MAX_NEST_DEPTH.
 */
export default function BlockList({ blocks, depth = 0, containerId = null, activeInputRef, footer = false }) {
  const { addChildBlock } = useDocument()
  const [sheetOpen, setSheetOpen] = useState(false)
  const canAdd = footer && containerId && depth <= MAX_NEST_DEPTH

  return (
    <div className={`block-list ${depth > 0 ? 'nested' : ''}`}>
      {blocks.map((block, index) => (
        <BlockRenderer key={block.id} block={block} index={index} total={blocks.length} depth={depth} activeInputRef={activeInputRef} />
      ))}
      {canAdd && (
        <>
          <button type="button" className="add-inside-btn" onClick={() => setSheetOpen(true)}>
            <Icon name="plus" size={13} /> Add block inside
          </button>
          <AddBlockSheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            onPick={(item) => addChildBlock(containerId, item.type, item.props || {})}
          />
        </>
      )}
    </div>
  )
}
