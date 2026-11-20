import { api } from 'sdk';
import { sendHome, sendHelp } from '../lib/ui.js';

function getCommand(text = '') {
  const [raw = ''] = text.trim().split(/\s+/);
  return raw.split('@', 1)[0].toLowerCase();
}

export default async function handleMessage(update) {
  const message = update?.message;
  if (!message?.chat?.id || !message?.from?.id) return;

  if (message.chat.type !== 'private') {
    if (message.text?.trim().startsWith('/')) {
      await api.sendMessage({
        chat_id: message.chat.id,
        text: 'Please open the bot in a private chat to use the storefront.',
      });
    }
    return;
  }

  const command = getCommand(message.text || '');
  if (command === '/start' || command === '/menu') {
    const firstName = message.from.first_name || 'there';
    await sendHome(message.chat.id, firstName);
    return;
  }

  if (command === '/help') {
    await sendHelp(message.chat.id);
    return;
  }

  if (message.text?.startsWith('/')) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: 'Unknown command. Use /menu to open the storefront or /help for assistance.',
    });
  }
}
