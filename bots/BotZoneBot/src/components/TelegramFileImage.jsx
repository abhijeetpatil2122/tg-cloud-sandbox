import React, { useEffect, useState } from 'react'
import { api } from '../telegram/api.js'

export default function TelegramFileImage({ fileId, alt = '' }) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    let active = true
    setSrc('')
    if (!fileId) return () => { active = false }

    api.getMediaPreview(fileId)
      .then((result) => {
        if (active && result?.data_url) setSrc(result.data_url)
      })
      .catch(() => {})

    return () => { active = false }
  }, [fileId])

  return <img src={src || undefined} alt={alt} />
}
