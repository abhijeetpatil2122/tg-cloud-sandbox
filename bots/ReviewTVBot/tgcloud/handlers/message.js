import { api } from 'sdk';

export default async function (message) {
  if (!message?.chat?.id || typeof message.text !== 'string') return;

  const command = message.text.trim().split(/\s+/, 1)[0].split('@', 1)[0].toLowerCase();

  if (command === '/start') {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: [
        'Welcome to ReviewTVBot.',
        '',
        'You will be able to submit reviews for movies, TV shows, and anime.',
        'Choose a category, write your review, preview it, and confirm before it is published.',
        '',
        'Review submissions are being prepared. Please check back soon.'
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
        'Use /review to start a review once submissions are enabled.',
        'Use /myreviews to view your published reviews.',
        'Use /cancel to cancel an active draft.'
      ].join('\n')
    });
  }
}
