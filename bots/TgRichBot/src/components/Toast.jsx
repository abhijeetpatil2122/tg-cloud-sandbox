import React, { useEffect, useState } from 'react'
import Icon from './Icon.jsx'

/** Controlled by a { type: 'success'|'error', message } object from the parent, or null to hide. */
export default function Toast({ toast, onDone }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!toast) return
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), 3200)
    const cleanup = setTimeout(() => onDone?.(), 3500)
    return () => {
      clearTimeout(timer)
      clearTimeout(cleanup)
    }
  }, [toast, onDone])

  if (!toast) return null

  return (
    <div className={`toast ${toast.type} ${visible ? 'visible' : ''}`}>
      <Icon name={toast.type === 'success' ? 'check' : 'error'} size={16} />
      <span>{toast.message}</span>
    </div>
  )
}
