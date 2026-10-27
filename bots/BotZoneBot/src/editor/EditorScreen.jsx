import React, { useEffect, useRef, useState } from 'react'
import EditorHeader from './EditorHeader.jsx'
import BlockToolbar from './BlockToolbar.jsx'
import BlockList from './BlockList.jsx'
import SendSheet from './SendSheet.jsx'
import Toast from '../components/Toast.jsx'
import { useDocument } from '../store/DocumentContext.jsx'
import { buildRichMessageBlocks } from '../document/richMessageBuilder.js'
import { configureMainButton, setMainButton } from '../telegram/webApp.js'

export default function EditorScreen({ user, channels, onOpenSettings }) {
  const { doc, isEmpty } = useDocument()
  const activeInputRef = useRef(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const cleanup = configureMainButton({ onClick: () => setSheetOpen(true) })
    // Hide on unmount (e.g. navigating to Settings) — MainButton's own
    // state otherwise persists globally and would stay stuck showing.
    return () => {
      cleanup()
      setMainButton({ visible: false })
    }
  }, [])

  useEffect(() => {
    setMainButton({ visible: !isEmpty && !sheetOpen, text: 'Send', active: true })
  }, [isEmpty, sheetOpen])

  const blocks = sheetOpen ? buildRichMessageBlocks(doc) : null

  return (
    <div className="app">
      <EditorHeader user={user} onOpenSettings={onOpenSettings} />

      <div className="editor-canvas">
        <BlockList blocks={doc.blocks} depth={0} activeInputRef={activeInputRef} />
      </div>

      <BlockToolbar activeInputRef={activeInputRef} />

      <SendSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        user={user}
        channels={channels}
        blocks={blocks || []}
        onResult={setToast}
        onManageChannels={() => {
          setSheetOpen(false)
          onOpenSettings()
        }}
      />

      <Toast toast={toast} onDone={() => setToast(null)} />
    </div>
  )
}