import { api } from 'sdk';
import {
  connectForum,
  setCategoryTopic,
  showSettings,
  disconnectForum,
} from '../lib/forum.js';

function parseCommand(text) {
  const [rawCommand, ...args] = text.trim().split(/\s+/);
  const command = rawCommand.split('@', 1)[0].toLowerCase();
  return { command, args };
}

export default async function (message) {
  if (!message?.chat?.id || typeof message.text !== 'string') return;

  const { command, args } = parseCommand(message.text);
  if (!command.startsWith('/')) return;

  try {
    if (command === '/connect') {
      await connectForum(message);
      return;
    }

    if (command === '/settopic') {
      await setCategoryTopic(message, args[0] ?? '');
      return;
    }

    if (command === '/settings') {
      await showSettings(message);
      return;
    }

    if (command === '/disconnect') {
      await disconnectForum(message, args[0]);
      return;
    }

    if (command === '/start') {
      await api.sendMessage({
        chat_id: message.chat.id,
        text: [
          'Welcome to ReviewTVBot.',
          '',
          'Submit reviews for movies, TV shows, and anime.',
          'Choose a category, write your review, preview it, and confirm before it is published.',
          '',
          'Review submission is being prepared. The forum owner can use /settings to check the destination setup.'
        ].join('\n')
      });
      return;
    }

    if (command === '/help') {
      await api.sendMessage({
        chat_id: message.chat.id,
        text: [
          'ReviewTVBot help',
          '',
          'Member commands:',
          '/review — start a review (submission flow is coming next)',
          '/myreviews — view your published reviews (coming next)',
          '/cancel — cancel a draft (coming next)',
          '',
          'Forum owner commands:',
          '/connect — connect this forum (run as the group creator)',
          '/settopic category_key — map the current topic to a category',
          '/settings — show the topic mapping status',
          '/disconnect confirm — disable forum publishing'
        ].join('\n')
      });
    }
  } catch (error) {
    console.error('ReviewTVBot message handler failed', error);
    try {
      await api.sendMessage({
        chat_id: message.chat.id,
        text: 'Sorry, that action could not be completed. Please check the command and try again. If the problem continues, contact the bot owner.'
      });
    } catch (sendError) {
      console.error('ReviewTVBot could not send its fallback error message', sendError);
    }
  }
}
