import { api } from 'sdk';

const WELCOME = [
  { type: 'heading', size: 2, text: 'Welcome to RichDocsBot' },
  { type: 'paragraph', text: 'Search the official Telegram Bot API documentation directly from any chat using inline mode.' },
  { type: 'paragraph', text: ['Start typing ', { type: 'bold', text: '@RichDocsBot' }, ' in any chat, then add a method, parameter, or type name.'] },
  { type: 'paragraph', text: ['For example: ', { type: 'code', text: '@RichDocsBot sendMessage' }] },
  { type: 'paragraph', text: ['Use ', { type: 'code', text: '/help' }, ' to see commands, or ', { type: 'code', text: '/howtouse' }, ' for a quick tutorial.'] },
  { type: 'footer', text: 'Official Telegram Bot API schema · Rich Message results' },
];

const HELP = [
  { type: 'heading', size: 2, text: 'RichDocsBot · Help' },
  { type: 'paragraph', text: 'Find Telegram Bot API methods, parameters, types, and objects with inline search.' },
  { type: 'heading', size: 4, text: 'Commands' },
  {
    type: 'list',
    items: [
      { blocks: [{ type: 'paragraph', text: [{ type: 'bold', text: '/start' }, ' — Welcome message'] }] },
      { blocks: [{ type: 'paragraph', text: [{ type: 'bold', text: '/help' }, ' — Show this command menu'] }] },
      { blocks: [{ type: 'paragraph', text: [{ type: 'bold', text: '/howtouse' }, ' — Learn how to search and use results'] }] },
      { blocks: [{ type: 'paragraph', text: [{ type: 'bold', text: '/about' }, ' — About RichDocsBot'] }] },
    ],
  },
  { type: 'heading', size: 4, text: 'Inline search examples' },
  { type: 'paragraph', text: ['Method: ', { type: 'code', text: '@RichDocsBot sendMessage' }] },
  { type: 'paragraph', text: ['Parameter: ', { type: 'code', text: '@RichDocsBot chat_id' }] },
  { type: 'paragraph', text: ['Type: ', { type: 'code', text: '@RichDocsBot ChatMember' }] },
  { type: 'footer', text: 'Use /howtouse for the step-by-step tutorial.' },
];

const HOW_TO_USE = [
  { type: 'heading', size: 2, text: 'How to use RichDocsBot' },
  { type: 'paragraph', text: 'RichDocsBot searches the current official Telegram Bot API schema and formats each result as a native Rich Message.' },
  { type: 'heading', size: 4, text: '1. Start an inline query' },
  { type: 'paragraph', text: ['Open any chat and type ', { type: 'bold', text: '@RichDocsBot' }, ', followed by a search term. You do not need to send the query as a message.'] },
  { type: 'heading', size: 4, text: '2. Search what you need' },
  {
    type: 'list',
    items: [
      { blocks: [{ type: 'paragraph', text: ['Methods, e.g. ', { type: 'code', text: 'sendMessage' }] }] },
      { blocks: [{ type: 'paragraph', text: ['Parameters, e.g. ', { type: 'code', text: 'chat_id' }] }] },
      { blocks: [{ type: 'paragraph', text: ['Types and objects, e.g. ', { type: 'code', text: 'ChatMember' }] }] },
      { blocks: [{ type: 'paragraph', text: 'Search by a partial name or a descriptive keyword if you do not remember the exact name.' }] },
    ],
  },
  { type: 'heading', size: 4, text: '3. Open a result' },
  { type: 'paragraph', text: 'Choose an article to insert its formatted documentation into the chat. Method and object results include parameter or field tables, linked types where available, and a link to the official documentation.' },
  { type: 'heading', size: 4, text: '4. Browse more matches' },
  { type: 'paragraph', text: 'Scroll the inline results list to load further pages when more than 50 matches are available.' },
  { type: 'paragraph', text: [{ type: 'url', text: 'Official Telegram Bot API documentation', url: 'https://core.telegram.org/bots/api' }] },
  { type: 'footer', text: 'Error-reference search is not included in this phase.' },
];

const ABOUT = [
  { type: 'heading', size: 2, text: 'About RichDocsBot' },
  { type: 'paragraph', text: 'RichDocsBot is a Telegram inline documentation browser for developers building Telegram bots.' },
  { type: 'paragraph', text: 'It reads Telegram’s published Bot API OpenAPI schema and presents searchable methods, parameters, types, return types, and object fields in structured Rich Messages.' },
  { type: 'heading', size: 4, text: 'Data source' },
  { type: 'paragraph', text: [{ type: 'url', text: 'Telegram Bot API documentation', url: 'https://core.telegram.org/bots/api' }] },
  { type: 'paragraph', text: [{ type: 'url', text: 'Live Bot API JSON schema', url: 'https://corefork.telegram.org/bots/api.json' }] },
  { type: 'footer', text: 'Built for quick developer reference · RichDocsBot' },
];

const COMMANDS = {
  '/start': WELCOME,
  '/help': HELP,
  '/howtouse': HOW_TO_USE,
  '/about': ABOUT,
};

export default async function (message) {
  const text = String(message.text || '').trim();
  if (!text.startsWith('/')) return;
  const command = text.split(/\s+/)[0].split('@')[0].toLowerCase();
  const blocks = COMMANDS[command];
  if (!blocks) return;

  await api.sendRichMessage({
    chat_id: message.chat.id,
    rich_message: { blocks },
  });
}
