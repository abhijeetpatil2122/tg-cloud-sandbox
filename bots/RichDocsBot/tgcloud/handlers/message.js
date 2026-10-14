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
    type: 'expandable_blockquote',
    text: [
      'Methods\n',
      { type: 'code', text: 'sendMessage' }, ' — method and its parameters\n',
      { type: 'code', text: 'sendMessage.' }, ' — all parameters\n\n',
      'Types and objects\n',
      { type: 'code', text: 'User' }, ' — object overview\n',
      { type: 'code', text: 'User.' }, ' — all fields',
    ],
  },
  { type: 'heading', size: 4, text: 'Filter' },
  {
    type: 'expandable_blockquote',
    text: [
      'Methods\n',
      { type: 'code', text: 'sendMessage.text' }, ' — one parameter\n',
      { type: 'code', text: 'sendMessage.text,parse_mode' }, ' — selected parameters in one table\n\n',
      'Types and objects\n',
      { type: 'code', text: 'User.first_name' }, ' — one field\n',
      { type: 'code', text: 'User.id,first_name,username' }, ' — selected fields in one table\n\n',
      { type: 'code', text: 'chat_id' }, ' — find a parameter across methods',
    ],
  },
  { type: 'heading', size: 4, text: 'Errors' },
  {
    type: 'expandable_blockquote',
    text: [
      'Use ', { type: 'code', text: '@RichDocsBot E' }, ' followed by a method, error phrase, or status code.\n',
      { type: 'code', text: 'E sendMessage' }, ' — errors associated with a method\n',
      { type: 'code', text: 'E BUTTON_URL_INVALID' }, ' — search by error identifier\n',
      { type: 'code', text: 'E message is not modified' }, ' — search error text\n',
      { type: 'code', text: 'E 429' }, ' — browse errors by status code',
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
      {
        blocks: [{
          type: 'paragraph',
          text: [{
            type: 'button',
            button: {
              text: 'Errors JSON database',
              url: 'https://corefork.telegram.org/bots/errors.json',
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
  '/help': getHelpBlocks,
  '/howtouse': () => HOW_TO_USE,
  '/about': () => ABOUT,
};

const STATS_ADMIN_ID = 1314643983;

function getHelpBlocks(message) {
  const blocks = HELP.map((block) => (
    block.type === 'list' ? { ...block, items: [...block.items] } : block
  ));

  if (message.from?.id === STATS_ADMIN_ID && message.chat?.type === 'private') {
    const commandList = blocks.find((block) => block.type === 'list');
    commandList.items.push({
      blocks: [{ type: 'paragraph', text: '/stats — Private usage statistics (admin only)' }],
    });
  }

  return blocks;
}

export default async function (message) {
  const text = String(message.text || '').trim();
  if (!text.startsWith('/')) return;
  const command = text.split(/\s+/)[0].split('@')[0].toLowerCase();

  if (command === '/stats') {
    if (message.from?.id !== STATS_ADMIN_ID || message.chat?.type !== 'private') return;

    let blocks;
    try {
      const stats = await getInlineUsageStats();
      blocks = [
        { type: 'heading', size: 2, text: 'Global inline usage stats' },
        {
          type: 'table',
          cells: [
            [{ text: 'Metric', is_header: true }, { text: 'Count', is_header: true }],
            [{ text: 'Total inline queries' }, { text: String(stats.totalQueries) }],
            [{ text: 'Documentation queries' }, { text: String(stats.docsQueries) }],
            [{ text: 'Error-search queries' }, { text: String(stats.errorQueries) }],
            [{ text: 'Unique users' }, { text: String(stats.uniqueUsers) }],
          ],
          caption: 'Global usage since tracking began',
          is_bordered: true,
          is_striped: true,
          is_compact: true,
        },
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
