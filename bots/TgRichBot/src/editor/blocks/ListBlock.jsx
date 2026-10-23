import React from 'react'
import RichTextInput from './shared/RichTextInput.jsx'
import Icon from '../../components/Icon.jsx'
import { useDocument } from '../../store/DocumentContext.jsx'
import { LIST_STYLE } from '../../document/schema.js'

function Marker({ style, index, checked, onToggle }) {
  if (style === LIST_STYLE.NUMBER) return <span className="list-marker">{index + 1}.</span>
  if (style === LIST_STYLE.CHECKLIST) {
    return (
      <button
        type="button"
        className={`list-checkbox ${checked ? 'checked' : ''}`}
        onClick={onToggle}
        aria-label="Toggle done"
      >
        {checked && <Icon name="check" size={13} strokeWidth={3.2} />}
      </button>
    )
  }
  return <span className="list-marker bullet" />
}

export default function ListBlock({ block, activeInputRef }) {
  const { updateListItem, addListItem, removeListItem } = useDocument()

  return (
    <div className="list-block">
      {block.items.map((item, index) => (
        <div className="list-item-row" key={item.id}>
          <Marker
            style={block.style}
            index={index}
            checked={item.checked}
            onToggle={() => updateListItem(block.id, item.id, { checked: !item.checked })}
          />
          <RichTextInput
            html={item.html}
            multiline={false}
            placeholder={block.style === LIST_STYLE.CHECKLIST ? 'To-do item' : 'List item'}
            onChange={(html) => updateListItem(block.id, item.id, { html })}
            onEnterNext={() => addListItem(block.id, item.id)}
            onBackspaceEmpty={() => block.items.length > 1 && removeListItem(block.id, item.id)}
            activeInputRef={activeInputRef}
          />
          {block.items.length > 1 && (
            <button
              className="icon-btn list-item-remove"
              type="button"
              onClick={() => removeListItem(block.id, item.id)}
              aria-label="Remove item"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
      ))}
      <button type="button" className="list-add-row" onClick={() => addListItem(block.id)}>
        + Add item
      </button>
    </div>
  )
}
