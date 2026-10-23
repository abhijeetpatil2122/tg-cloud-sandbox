// Saved chats are stored in this bot's own Telegram Serverless SQLite database.
import { api } from './api.js'

export async function loadChannels() {
  const result = await api.listChannels()
  return Array.isArray(result?.channels) ? result.channels : []
}

export async function saveChannel(channel) {
  if (channel?.id === undefined || channel?.id === null) return
  return api.verifyChannel(channel.id)
}

export async function removeChannel(id) {
  return api.removeChannel(id)
}
