import React, { useEffect, useState } from 'react'
import Icon from './Icon.jsx'

// Mounted only while `open` (or during its closing transition) is true —
// the parent controls that with its own `open` boolean; this component
// just handles the enter/exit animation and backdrop/✕ dismissal.
export default function BottomSheet({ open, onClose, title, children }) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      // Next tick so the transform transition actually runs.
      const id = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(id)
    }
    setVisible(false)
    const timeout = setTimeout(() => setMounted(false), 280)
    return () => clearTimeout(timeout)
  }, [open])

  if (!mounted) return null

  return (
    <>
      <div className={`sheet-backdrop ${visible ? 'open' : ''}`} onClick={onClose} />
      <div className={`sheet ${visible ? 'open' : ''}`} role="dialog" aria-modal="true">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>
  )
}
