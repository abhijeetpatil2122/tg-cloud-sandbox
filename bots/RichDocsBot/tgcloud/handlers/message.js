import { api } from 'sdk';
import { getInlineUsageStats } from '../lib/usage-stats.js';

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
  { type: 'heading', size: 4, text: 'Errors' },
  { type: 'paragraph', text: ['Use ', { type: 'code', text: '@RichDocsBot E' }, ' followed by a method, error phrase, or status code.'] },
  {
    type: 'list',
    items: [
      { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'E sendMessage' }, ' — errors associated with a method'] }] },
      { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'E BUTTON_URL_INVALID' }, ' — search by error identifier'] }] },
      { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'E message is not modified' }, ' — search error text'] }] },
      { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'E 429' }, ' — browse errors by status code'] }] },
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

const STATS_ADMIN_ID = 1314643983;

export default async function (message) {
  const text = String(message.text || '').trim();
  if (!text.startsWith('/')) return;
  const command = text.split(/\s+/)[0].split('@')[0].toLowerCase();

  if (command === '/stats') {
    if (message.from?.id !== STATS_ADMIN_ID) return;

    let blocks;
    try {
      const stats = await getInlineUsageStats();
      blocks = [
        { type: 'heading', size: 2, text: 'Global inline usage stats' },
        { type: 'paragraph', text: [{ type: 'bold', text: 'Total inline queries: ' }, String(stats.totalQueries)] },
        { type: 'paragraph', text: [{ type: 'bold', text: 'Documentation queries: ' }, String(stats.docsQueries)] },
        { type: 'paragraph', text: [{ type: 'bold', text: 'Error-search queries: ' }, String(stats.errorQueries)] },
        { type: 'paragraph', text: [{ type: 'bold', text: 'Unique users: ' }, String(stats.uniqueUsers)] },
        { type: 'paragraph', text: 'Counts track inline-query requests received by the bot, not selected or sent results.' },
      ];
    } catch (error) {
      console.error('RichDocsBot /stats failed:', error && error.message ? error.message : error);
      blocks = [
        { type: 'heading', size: 2, text: 'Usage stats unavailable' },
        { type: 'paragraph', text: 'The usage database is not ready. Apply the pending Serverless database migration, then try /stats again.' },
      ];
    }

    await api.sendRichMessage({
      chat_id: message.chat.id,
      rich_message: { blocks },
    });
    return;
  }

  const getBlocks = COMMANDS[command];
  if (!getBlocks) return;

  await api.sendRichMessage({
    chat_id: message.chat.id,
    rich_message: { blocks: getBlocks(message) },
  });
}
