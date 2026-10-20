import { api } from 'sdk';
import { getCommandMessage } from '../lib/botMessages.js';

const KNOWN_COMMANDS = new Set(['start', 'help', 'howtouse', 'about']);

export default async function (message) {
  const chatId = message?.chat?.id;
  if (!chatId || message.chat.type !== 'private') return;

  const text = typeof message.text === 'string' ? message.text.trim() : '';
  if (!text.startsWith('/')) return;
  const command = text.split(/\s+/)[0].slice(1).split('@')[0].toLowerCase();
  if (!KNOWN_COMMANDS.has(command)) return;

  const reply = getCommandMessage(command, message.from);
  if (!reply) return;

  await api.sendRichMessage({
    chat_id: chatId,
    rich_message: { blocks: reply.blocks }
  });
}
