import { api } from 'sdk';

function getWelcomeBlocks(message) {
  const firstName = String(message.from?.first_name || '').trim();
  const lastName = String(message.from?.last_name || '').trim();
  const name = [firstName, lastName].filter(Boolean).join(' ') || 'there';

  return [
    { type: 'heading', size: 2, text: `Welcome ${name} to Telegram Docs Bot` },
    { type: 'paragraph', text: 'Search Telegram Bot API methods, parameters, and types directly from any chat with quick inline documentation.' },
    {
      type: 'list',
      items: [
        { blocks: [{ type: 'paragraph', text: 'Type @RichDocsBot sendMessage in a chat to search methods.' }] },
        { blocks: [{ type: 'paragraph', text: 'Search types and objects with queries such as @RichDocsBot ChatMember.' }] },
      ],
    },
    { type: 'divider' },
    { type: 'footer', text: 'For more, send /help' },
  ];
}

const HELP = [
  { type: 'heading', size: 2, text: 'Help' },
  { type: 'paragraph', text: 'Available commands:' },
  {
    type: 'list',
    items: [
      { blocks: [{ type: 'paragraph', text: '/start — Introduction' }] },
      { blocks: [{ type: 'paragraph', text: '/help — Get this menu' }] },
      { blocks: [{ type: 'paragraph', text: '/howtouse — Detailed Search Guide' }] },
      { blocks: [{ type: 'paragraph', text: '/about — About the bot' }] },
    ],
  },
];

const HOW_TO_USE = [
  { type: 'heading', size: 2, text: 'Inline search guide' },
  { type: 'paragraph', text: ['Type ', { type: 'code', text: '@RichDocsBot' }, ' followed by a method, type, or parameter name in any chat.'] },
  { type: 'heading', size: 4, text: 'Browse' },
  {
    type: 'list',
    items: [
      {
        blocks: [
          { type: 'paragraph', text: 'Methods' },
          {
            type: 'list',
            items: [
              { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'sendMessage' }, ' — method and its parameters'] }] },
              { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'sendMessage.' }, ' — all parameters'] }] },
            ],
          },
        ],
      },
      {
        blocks: [
          { type: 'paragraph', text: 'Types and objects' },
          {
            type: 'list',
            items: [
              { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'User' }, ' — object overview'] }] },
              { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'User.' }, ' — all fields'] }] },
            ],
          },
        ],
      },
    ],
  },
  { type: 'heading', size: 4, text: 'Filter' },
  {
    type: 'list',
    items: [
      {
        blocks: [
          { type: 'paragraph', text: 'Methods' },
          {
            type: 'list',
            items: [
              { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'sendMessage.text' }, ' — one parameter'] }] },
              { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'sendMessage.text,parse_mode' }, ' — selected parameters in one table'] }] },
            ],
          },
        ],
      },
      {
        blocks: [
          { type: 'paragraph', text: 'Types and objects' },
          {
            type: 'list',
            items: [
              { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'User.first_name' }, ' — one field'] }] },
              { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'User.id,first_name,username' }, ' — selected fields in one table'] }] },
            ],
          },
        ],
      },
      { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'chat_id' }, ' — find a parameter across methods'] }] },
    ],
  },
];

const ABOUT = [
  { type: 'heading', size: 2, text: 'About RichDocsBot' },
  { type: 'paragraph', text: 'An inline documentation browser for the Telegram Bot API. Results are built from the published OpenAPI schema and delivered as native Rich Messages.' },
  { type: 'heading', size: 4, text: 'Sources' },
  {
    type: 'list',
    items: [
      {
        blocks: [{
          type: 'paragraph',
          text: [{
            type: 'button',
            button: {
              text: 'Telegram Bot API',
              url: 'https://core.telegram.org/bots/api',
              style: 'primary',
            },
          }],
        }],
      },
      {
        blocks: [{
          type: 'paragraph',
          text: [{
            type: 'button',
            button: {
              text: 'OpenAPI JSON schema',
              url: 'https://corefork.telegram.org/bots/api.json',
              style: 'primary',
            },
          }],
        }],
      },
    ],
  },
];

const COMMANDS = {
  '/start': getWelcomeBlocks,
  '/help': () => HELP,
  '/howtouse': () => HOW_TO_USE,
  '/about': () => ABOUT,
};

export default async function (message) {
  const text = String(message.text || '').trim();
  if (!text.startsWith('/')) return;
  const command = text.split(/\s+/)[0].split('@')[0].toLowerCase();
  const getBlocks = COMMANDS[command];
  if (!getBlocks) return;

  await api.sendRichMessage({
    chat_id: message.chat.id,
    rich_message: { blocks: getBlocks(message) },
  });
}
