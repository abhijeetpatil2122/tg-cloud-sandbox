// Saved chats live in the bot's SQLite database. On the first launch after
// migration, import any legacy CloudStorage entries and leave them untouched
// so a rollback can still recover them.
import { api } from './api.js'
import { getWebApp } from './webApp.js'

const INDEX_KEY = 'rich_channels_index'
const MIGRATION_KEY = 'rich_channels_sqlite_migration_v1'
const itemKey = (id) => 'rich_channel_' + String(id).replace(/^-/, 'n')

function cloud() {
  const storage = getWebApp()?.CloudStorage
  if (!storage) throw new Error('CloudStorage is only available inside Telegram.')
  return storage
}

function cloudCall(method, ...args) {
  return new Promise((resolve, reject) => {
    cloud()[method](...args, (error, result) => (
      error ? reject(new Error(String(error))) : resolve(result)
    ))
  })
}

async function loadLegacyChannels() {
  const raw = await cloudCall('getItem', INDEX_KEY)
  if (!raw) return []
  let ids
  try { ids = JSON.parse(raw) } catch { return [] }
  if (!Array.isArray(ids) || !ids.length) return []
  const keys = ids.map(itemKey)
  const values = await cloudCall('getItems', keys)
  return ids.map((id) => {
    const value = values?.[itemKey(id)]
    if (!value) return null
    try { return JSON.parse(value) } catch { return null }
  }).filter(Boolean)
}

async function importLegacyChannelsOnce() {
  const marker = await cloudCall('getItem', MIGRATION_KEY)
  if (marker === '1') return false

  const legacyChannels = await loadLegacyChannels()
  for (const channel of legacyChannels) {
    if (channel?.id === undefined || channel?.id === null) continue
    try {
      // The server re-fetches the chat and verifies posting permission; old
      // CloudStorage contents are never trusted as authorization.
      await api.verifyChannel(channel.id)
    } catch (error) {
      console.warn('Could not migrate saved chat:', channel?.id, error?.message || error)
    }
  }

  // Set the marker only after attempting the import. Keep the original records.
  await cloudCall('setItem', MIGRATION_KEY, '1')
  return legacyChannels.length > 0
}

export async function loadChannels() {
  let result = await api.listChannels()
  try {
    const imported = await importLegacyChannelsOnce()
    if (imported) result = await api.listChannels()
  } catch (error) {
    // CloudStorage may be unavailable in some launch contexts; SQLite remains usable.
    console.warn('Legacy saved-chat import was skipped:', error?.message || error)
  }
  return Array.isArray(result?.channels) ? result.channels : []
}

export async function saveChannel(channel) {
  if (channel?.id === undefined || channel?.id === null) return
  return api.verifyChannel(channel.id)
}

export async function removeChannel(id) {
  return api.removeChannel(id)
}
