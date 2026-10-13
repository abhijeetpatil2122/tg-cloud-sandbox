import { api } from 'sdk';

const WELCOME = [
  { type: 'heading', size: 2, text: 'RichDocsBot' },
  { type: 'paragraph', text: 'Search Telegram Bot API methods, parameters, and types from any chat.' },
  { type: 'paragraph', text: ['Type ', { type: 'code', text: '@RichDocsBot sendMessage' }, ' in a chat to browse documentation.'] },
  { type: 'paragraph', text: ['Use ', { type: 'code', text: '/help' }, ' for commands or ', { type: 'code', text: '/howtouse' }, ' for search examples.'] },
];

const HELP = [
  { type: 'heading', size: 2, text: 'Help' },
  { type: 'paragraph', text: 'Use inline mode to search the Telegram Bot API.' },
  { type: 'heading', size: 4, text: 'Commands' },
  { type: 'list', items: [
    { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: '/start' }, ' — Introduction'] }] },
    { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: '/help' }, ' — Commands and search formats'] }] },
    { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: '/howtouse' }, ' — Search guide'] }] },
    { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: '/about' }, ' — Data source'] }] },
  ] },
  { type: 'heading', size: 4, text: 'Search formats' },
  { type: 'list', items: [
    { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'sendMessage' }, ' — Method and related matches'] }] },
    { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'sendMessage.' }, ' — All parameter articles'] }] },
    { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'sendMessage.text' }, ' — One parameter'] }] },
    { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'sendMessage.text,parse_mode' }, ' — Selected parameters in one table'] }] },
    { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'User.id,first_name' }, ' — Selected object fields'] }] },
  ] },
];

const HOW_TO_USE = [
  { type: 'heading', size: 2, text: 'Inline search guide' },
  { type: 'paragraph', text: ['In any chat, type ', { type: 'code', text: '@RichDocsBot' }, ' followed by a query. Choose an article to send its Rich Message documentation.'] },
  { type: 'heading', size: 4, text: '1. Browse documentation' },
  { type: 'list', items: [
    { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'sendMessage' }, ' — Matching methods, with the full parameter table'] }] },
    { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'User' }, ' — Object documentation and fields'] }] },
    { blocks: [{ type: 'paragraph', text: 'Leave the query empty to browse methods; scroll for more results.' }] },
  ] },
  { type: 'heading', size: 4, text: '2. Filter parameters or fields' },
  { type: 'list', items: [
    { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'sendMessage.' }, ' — List all parameters separately'] }] },
    { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'sendMessage.text' }, ' — One parameter'] }] },
    { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'sendMessage.text,parse_mode' }, ' — One table with both parameters'] }] },
    { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'User.id,first_name,username' }, ' — One table with selected object fields'] }] },
  ] },
  { type: 'heading', size: 4, text: '3. Send an article' },
  { type: 'paragraph', text: 'Select a result to insert the documentation into the chat. Type references and the source documentation link are clickable.' },
];

const ABOUT = [
  { type: 'heading', size: 2, text: 'About RichDocsBot' },
  { type: 'paragraph', text: 'An inline documentation browser for the Telegram Bot API. Results are built from the published OpenAPI schema and delivered as native Rich Messages.' },
  { type: 'heading', size: 4, text: 'Sources' },
  { type: 'list', items: [
    { blocks: [{ type: 'paragraph', text: [{ type: 'url', text: 'Telegram Bot API documentation', url: 'https://core.telegram.org/bots/api' }] }] },
    { blocks: [{ type: 'paragraph', text: [{ type: 'url', text: 'OpenAPI JSON schema', url: 'https://corefork.telegram.org/bots/api.json' }] }] },
  ] },
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
