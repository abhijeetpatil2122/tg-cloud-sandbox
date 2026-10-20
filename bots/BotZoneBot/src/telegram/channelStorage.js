// Persists saved channels in Telegram's own CloudStorage (per user, per
// bot, synced across the user's devices — no backend database needed).
// Limits: up to 1024 keys, keys 1-128 chars [A-Za-z0-9_-], values up to
// 4096 chars. https://core.telegram.org/bots/webapps#cloudstorage
import { getWebApp } from './webApp.js'

const INDEX_KEY = 'rich_channels_index'
const itemKey = (id) => `rich_channel_${String(id).replace(/^-/, 'n')}`

function cloud() {
  const storage = getWebApp()?.CloudStorage
  if (!storage) throw new Error('CloudStorage is only available inside Telegram.')
  return storage
}

function call(method, ...args) {
  return new Promise((resolve, reject) => {
    cloud()[method](...args, (error, result) => (error ? reject(new Error(String(error))) : resolve(result)))
  })
}

async function getIndex() {
  const raw = await call('getItem', INDEX_KEY)
  if (!raw) return []
  try {
    const ids = JSON.parse(raw)
    return Array.isArray(ids) ? ids : []
  } catch {
    return []
  }
}

async function setIndex(ids) {
  await call('setItem', INDEX_KEY, JSON.stringify(ids))
}

export async function loadChannels() {
  const ids = await getIndex()
  if (!ids.length) return []
  const keys = ids.map(itemKey)
  const values = await call('getItems', keys)
  return ids
    .map((id) => {
      const raw = values?.[itemKey(id)]
      if (!raw) return null
      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

export async function saveChannel(channel) {
  const ids = await getIndex()
  await call('setItem', itemKey(channel.id), JSON.stringify(channel))
  if (!ids.includes(channel.id)) await setIndex([...ids, channel.id])
}

export async function removeChannel(id) {
  const ids = await getIndex()
  await call('removeItem', itemKey(id))
  await setIndex(ids.filter((x) => x !== id))
}
