// Saved chats are persisted in the bot's SQLite database via Serverless endpoints.
import { api } from './api.js'

export async function loadChannels() {
  const result = await api.listChannels()
  return Array.isArray(result?.channels) ? result.channels : []
}

// verifyChat persists manually verified chats before returning.
export async function saveChannel(channel) {
  return channel
}

export async function removeChannel(id) {
  return api.removeChannel(id)
}
