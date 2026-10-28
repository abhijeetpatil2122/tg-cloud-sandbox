import React from 'react'
import BottomSheet from '../components/BottomSheet.jsx'
import Icon from '../components/Icon.jsx'
import { TOOLBAR_CATEGORIES } from '../document/toolbarConfig.js'

/** Same block catalog as the bottom toolbar, as a sheet — used to pick what to nest inside a container. */
export default function AddBlockSheet({ open, onClose, onPick, title = 'Add block inside' }) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="add-block-sheet">
        {TOOLBAR_CATEGORIES.map((category) => (
          <div key={category.id}>
            <div className="add-block-category">{category.label}</div>
            <div className="add-block-grid">
              {category.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="toolbar-item"
                  onClick={() => {
                    onPick(item)
                    onClose()
                  }}
                >
                  <span className="icon-circle">
                    <Icon name={item.icon} size={17} />
                  </span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </BottomSheet>
  )
}