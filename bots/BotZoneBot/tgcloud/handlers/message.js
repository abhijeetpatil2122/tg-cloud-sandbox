import { api } from 'sdk';

const HELP =
  'Telegram Mini App Demo\n\n' +
  '/start — show the demo and setup instructions\n' +
  '/help — show this menu\n\n' +
  'The Mini App frontend and backend endpoints are deployed together by Telegram Serverless.';

export default async function (message) {
  const chatId = message?.chat?.id;
  if (!chatId) return;

  const text = (message.text || '').trim();
  const command = (text.split(/\\s+/, 1)[0] || '').split('@')[0].toLowerCase();

  if (command === '/start') {
    return api.sendMessage({
      chat_id: chatId,
      text:
        'Welcome to the Telegram Mini App Demo 👋\n\n' +
        'This project demonstrates a hosted Mini App, authenticated backend endpoints, and persistent notes using Telegram Serverless.\n\n' +
        'Open the bot menu app after its URL is configured in BotFather. Use /help for setup details.',
    });
  }

  if (command === '/help') {
    return api.sendMessage({ chat_id: chatId, text: HELP });
  }
}
