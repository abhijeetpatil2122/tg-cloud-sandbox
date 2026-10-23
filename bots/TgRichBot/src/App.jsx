import React, { useEffect, useState, useCallback } from 'react'
import EditorScreen from './editor/EditorScreen.jsx'
import SettingsScreen from './settings/SettingsScreen.jsx'
import { DocumentProvider } from './store/DocumentContext.jsx'
import {
  initWebApp,
  getTelegramUser,
  configureBackButton,
  setBackButtonVisible,
  configureSettingsButton
} from './telegram/webApp.js'
import { loadChannels } from './telegram/channelStorage.js'

export default function App() {
  const [screen, setScreen] = useState('editor') // 'editor' | 'settings'
  const [user, setUser] = useState(null)
  const [channels, setChannels] = useState([])

  const refreshChannels = useCallback(() => {
    loadChannels()
      .then(setChannels)
      .catch(() => {})
  }, [])

  useEffect(() => {
    initWebApp()
    setUser(getTelegramUser())
    refreshChannels()
  }, [refreshChannels])

  const openSettings = useCallback(() => setScreen('settings'), [])
  const closeSettings = useCallback(() => setScreen('editor'), [])

  // Native BackButton navigates out of Settings.
  useEffect(() => {
    setBackButtonVisible(screen === 'settings')
    const cleanup = configureBackButton({ onClick: closeSettings })
    return cleanup
  }, [screen, closeSettings])

  // Native SettingsButton (in Telegram's own header) opens our Settings screen.
  useEffect(() => configureSettingsButton({ onClick: openSettings }), [openSettings])

  return (
    <DocumentProvider>
      {screen === 'editor' ? (
        <EditorScreen user={user} channels={channels} onOpenSettings={openSettings} />
      ) : (
        <SettingsScreen user={user} channels={channels} onChannelsChanged={refreshChannels} />
      )}
    </DocumentProvider>
  )
}
