import React, { useEffect, useState } from 'react'
import { api } from '../telegram/api.js'

const previewCache = new Map()

export default function TelegramFileImage({ fileId, alt = '' }) {
  const [src, setSrc] = useState(() => previewCache.get(fileId) || '')

  useEffect(() => {
    let active = true
    setSrc(previewCache.get(fileId) || '')
    if (!fileId || previewCache.has(fileId)) return () => { active = false }

    api.getMediaPreview(fileId)
      .then((result) => {
        if (!result?.data_url) throw new Error('The server did not return an image preview.')
        previewCache.set(fileId, result.data_url)
        if (active) setSrc(result.data_url)
      })
      .catch((error) => console.warn('Could not load Telegram chat avatar:', error?.message || error))

    return () => { active = false }
  }, [fileId])

  return <img src={src || undefined} alt={alt} referrerPolicy="no-referrer" />
}
