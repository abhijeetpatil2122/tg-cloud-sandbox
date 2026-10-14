import { API_ERRORS_URL, ERROR_ARTICLE_THUMBNAIL_URL, NO_RESULTS_THUMBNAIL_URL } from './config.js';
import { heading, paragraph, richTextLink, richTextFromDescription } from './rich-text.js';

function listItems(values) {
  return values.map((value) => ({ blocks: [{ type: 'paragraph', text: value }] }));
}

function methodBlocks(methods) {
  if (!methods.length) return [];
  const items = listItems(methods);
  if (methods.length > 8) {
    return [{ type: 'details', summary: 'Methods (' + methods.length + ')', blocks: [{ type: 'list', items }] }];
  }
  return [heading('Methods', 4), { type: 'list', items }];
}

export function getErrorHelpResult() {
  return {
    type: 'article',
    id: 'error-help',
    title: '❓ Error search guide',
    description: 'Search Bot API errors by method, message, or status code.',
    input_message_content: {
      rich_message: {
        blocks: [
          heading('Error search guide', 2),
          paragraph(['Type ', { type: 'code', text: '@RichDocsBot E' }, ' followed by a method name, error message, or status code.']),
          {
            type: 'details',
            summary: 'Search examples',
            blocks: [{
              type: 'list',
              items: [
                { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'E sendMessage' }, ' — errors associated with a method'] }] },
                { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'E BUTTON_URL_INVALID' }, ' — find an error by identifier or message'] }] },
                { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'E message is not modified' }, ' — search error text'] }] },
                { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'E 429' }, ' — browse errors by status code'] }] },
              ],
            }],
          },
        ],
      },
    },
  };
}

export function getErrorNoResultsResult() {
  return {
    type: 'article',
    id: 'error-no-results',
    title: 'No matching errors found',
    description: 'Try a method name, error phrase, identifier, or status code.',
    thumbnail_url: NO_RESULTS_THUMBNAIL_URL,
    input_message_content: {
      rich_message: {
        blocks: [
          heading('No matching errors found', 2),
        ],
      },
    },
  };
}

export function getErrorFallbackResult() {
  return {
    type: 'article',
    id: 'error-data-unavailable',
    title: 'Bot API error data is temporarily unavailable',
    description: 'Please try the error search again shortly.',
    thumbnail_url: NO_RESULTS_THUMBNAIL_URL,
    input_message_content: {
      rich_message: {
        blocks: [
          heading('Error data temporarily unavailable', 2),
          paragraph('RichDocsBot could not retrieve Telegram’s error database. Please try the inline query again in a moment.'),
          { type: 'paragraph', text: [richTextLink('Open the official error database', API_ERRORS_URL)] },
        ],
      },
    },
  };
}

export function toErrorInlineResult(item, index, version) {
  if (item.kind === 'help') return getErrorHelpResult();
  const blocks = [
    heading(item.message, 2),
    { type: 'paragraph', text: [{ type: 'bold', text: 'HTTP status code: ' }, item.code] },
  ];

  blocks.push(...methodBlocks(item.methods));

  if (item.parameters.length) {
    blocks.push(heading('Related response parameters', 4));
    blocks.push({ type: 'list', items: listItems(item.parameters) });
  }

  if (item.mtprotoErrors.length) {
    blocks.push(heading('MTProto mapping', 4));
    blocks.push({ type: 'list', items: listItems(item.mtprotoErrors) });
  }

  if (item.mtprotoDescriptions.length) {
    blocks.push(heading('MTProto descriptions', 4));
    for (const description of item.mtprotoDescriptions.slice(0, 5)) blocks.push(paragraph(richTextFromDescription(description)));
  }

  return {
    type: 'article',
    id: ('error:' + item.code + ':' + index).slice(0, 64),
    title: item.message.slice(0, 256),
    description: ('HTTP ' + item.code + ' · ' + item.methods.length + ' associated method(s)').slice(0, 256),
    thumbnail_url: ERROR_ARTICLE_THUMBNAIL_URL,
    input_message_content: { rich_message: { blocks } },
  };
}
