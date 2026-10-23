import React from 'react'
import Icon from '../../components/Icon.jsx'
import { useDocument } from '../../store/DocumentContext.jsx'

export default function SpacingBlock({ block }) {
  const { updateBlock } = useDocument()
  const lines = Math.max(1, Math.min(8, Number(block.lines) || 1))

  return (
    <div className="spacing-block">
      <span>Vertical spacing</span>
      <div className="spacing-controls">
        <button
          className="icon-btn"
          type="button"
          disabled={lines <= 1}
          onClick={() => updateBlock(block.id, { lines: lines - 1 })}
          aria-label="Decrease spacing"
        >
          <Icon name="minus" size={16} />
        </button>
        <span>{lines} {lines === 1 ? 'line' : 'lines'}</span>
        <button
          className="icon-btn"
          type="button"
          disabled={lines >= 8}
          onClick={() => updateBlock(block.id, { lines: lines + 1 })}
          aria-label="Increase spacing"
        >
          <Icon name="plus" size={16} />
        </button>
      </div>
    </div>
  )
}
