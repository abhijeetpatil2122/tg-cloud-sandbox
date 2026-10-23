import React, { useState } from 'react'
import Icon from '../../components/Icon.jsx'
import ButtonEditorSheet from './shared/ButtonEditorSheet.jsx'
import { useDocument } from '../../store/DocumentContext.jsx'
import { createButtonConfig } from '../../document/schema.js'

const ALIGNS = ['left', 'center', 'right']

export default function ButtonsBlock({ block }) {
  const { updateBlock } = useDocument()
  const [editingId, setEditingId] = useState(null) // button id, or 'new'

  function setButtons(buttons) {
    updateBlock(block.id, { buttons: buttons.length ? buttons : [createButtonConfig()] })
  }

  function saveButton(config) {
    if (editingId === 'new') {
      setButtons([...block.buttons, { ...createButtonConfig(), ...config }])
    } else {
      setButtons(block.buttons.map((b) => (b.id === editingId ? { ...b, ...config } : b)))
    }
    setEditingId(null)
  }

  function removeButton(id) {
    setButtons(block.buttons.filter((b) => b.id !== id))
  }

  const editingButton = editingId && editingId !== 'new' ? block.buttons.find((b) => b.id === editingId) : null
  const realButtons = block.buttons.filter((b) => b.text.trim())

  return (
    <div className="buttons-block">
      <div className="align-row">
        {ALIGNS.map((a) => (
          <button
            key={a}
            type="button"
            className={`chip ${block.align === a ? 'active' : ''}`}
            onClick={() => updateBlock(block.id, { align: a })}
          >
            <Icon name={`align-${a}`} size={13} />
          </button>
        ))}
      </div>

      <div className={`buttons-row align-${block.align}`}>
        {realButtons.length === 0 && <div className="buttons-empty">No buttons yet</div>}
        {realButtons.map((btn) => (
          <div key={btn.id} className={`rich-button-pill ${btn.style}`} onClick={() => setEditingId(btn.id)}>
            <Icon name={`action-${btn.actionType}`} size={13} />
            {btn.text}
            <button
              type="button"
              className="rich-button-remove"
              onClick={(e) => {
                e.stopPropagation()
                removeButton(btn.id)
              }}
            >
              <Icon name="close" size={11} />
            </button>
          </div>
        ))}
        <button type="button" className="buttons-add" onClick={() => setEditingId('new')}>
          <Icon name="plus" size={15} />
        </button>
      </div>

      <ButtonEditorSheet
        open={!!editingId}
        initial={editingButton}
        onClose={() => setEditingId(null)}
        onSave={saveButton}
      />
    </div>
  )
}