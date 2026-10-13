import { api } from 'sdk';

const HELP = [
  { type: 'heading', size: 2, text: 'RichDocsBot' },
  { type: 'paragraph', text: 'Search Telegram Bot API documentation directly from any chat with inline mode.' },
  { type: 'heading', size: 4, text: 'How to search' },
  {
    type: 'list',
    items: [
      { blocks: [{ type: 'paragraph', text: ['Type ', { type: 'bold', text: '@RichDocsBot' }, ' followed by a method name, such as ', { type: 'code', text: 'sendMessage' }, '.'] }] },
      { blocks: [{ type: 'paragraph', text: ['Search parameters like ', { type: 'code', text: 'chat_id' }, ' or object types like ', { type: 'code', text: 'ChatMember' }, '.'] }] },
      { blocks: [{ type: 'paragraph', text: 'Choose a result to send its formatted Rich Message documentation into the chat.' }] },
    ],
  },
  { type: 'paragraph', text: [{ type: 'url', text: 'Official Telegram Bot API documentation', url: 'https://core.telegram.org/bots/api' }] },
  { type: 'footer', text: 'Error-reference search will be added in a later phase.' },
];

export default async function (message) {
  const text = String(message.text || '').trim();
  if (!text.startsWith('/')) return;
  const command = text.split(/\s+/)[0].split('@')[0].toLowerCase();
  if (!['/start', '/help', '/about'].includes(command)) return;

  await api.sendRichMessage({
    chat_id: message.chat.id,
    rich_message: { blocks: HELP },
  });
}
