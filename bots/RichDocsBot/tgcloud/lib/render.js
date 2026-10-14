import { API_DOCS_URL } from './config.js';
import { richTextLink, paragraph, heading } from './rich-text.js';

function tableCellText(value) {
  if (!Array.isArray(value)) return String(value ?? '—');
  // Keep links inside table cells visually neutral. The style field is
  // optional in RichMessageButton, so omitting it lets Telegram choose the
  // app-specific default instead of rendering a colored primary button.
  return value.map((part) => {
    if (!part || typeof part !== 'object' || part.type !== 'button' || !part.button) return part;
    const { style, ...button } = part.button;
    return { ...part, button };
  });
}

function tableBlock(headers, rows, caption) {
  const cells = [headers, ...rows].map((row, rowIndex) => row.map((value) => ({
    text: tableCellText(value),
    ...(rowIndex === 0 ? { is_header: true } : {}),
  })));
  return {
    type: 'table',
    cells,
    ...(caption ? { caption } : {}),
    is_bordered: true,
    is_striped: true,
    is_compact: true,
  };
}

function tableDetails(summary, table, rowCount) {
  // Single-row parameter/field articles are already compact; keep them open.
  // Larger tables start collapsed to reduce the height of overview messages.
  if (rowCount <= 1) return table;
  return { type: 'details', summary, blocks: [table] };
}

export function renderDocBlocks(item, version = 'unknown') {
  const isFilteredEntry = item.kind === 'parameter' || item.kind === 'field';
  const isSelection = item.kind === 'selection';
  const blocks = [heading(item.title, 2)];

  if (!isFilteredEntry && !isSelection) {
    const descriptionText = item.descriptionRich?.length
      ? item.descriptionRich
      : (item.description || 'No description is available in the current schema.');
    if (item.kind === 'method') {
      blocks.push({ type: 'expandable_blockquote', text: descriptionText });
    } else {
      blocks.push(paragraph(descriptionText));
    }
    blocks.push({ type: 'paragraph', text: [{ type: 'bold', text: 'Category: ' }, item.category || (item.kind === 'method' ? 'Bot API method' : 'Types and objects')] });
  }

  if (item.kind === 'method') {
    if (item.params.length) {
      const rows = item.params.map((param) => [
        param.name,
        param.typeRich || [param.type],
        param.required ? 'Required' : 'Optional',
        param.descriptionRich?.length && param.description ? param.descriptionRich : (param.description || '—'),
      ]);
      const table = tableBlock(['Parameter', 'Type', 'Required', 'Description'], rows, item.params.length + ' parameter(s)');
      blocks.push(tableDetails('Parameters', table, rows.length));
    }
    if (item.returns) {
      blocks.push(heading('Return type', 4));
      blocks.push({ type: 'paragraph', text: [item.returnsLink
        ? richTextLink(item.returns, API_DOCS_URL + '#' + item.returns.toLowerCase())
        : item.returns] });
    }
  } else if (item.kind === 'type') {
    if (item.variants?.length) {
      blocks.push(heading('Variants', 4));
      blocks.push({
        type: 'list',
        items: item.variants.map((variant) => ({
          blocks: [{ type: 'paragraph', text: [variant.url ? richTextLink(variant.name, variant.url) : variant.name] }],
        })),
      });
    }
    if (item.properties?.length) {
      const rows = item.properties.map((field) => [
        field.name, field.typeRich || [field.type],
        field.required ? 'Required' : 'Optional',
        field.descriptionRich?.length && field.description ? field.descriptionRich : (field.description || '—'),
      ]);
      const table = tableBlock(['Field', 'Type', 'Required', 'Description'], rows, item.properties.length + ' field(s)');
      blocks.push(tableDetails('Fields', table, rows.length));
    }
  } else if (item.kind === 'selection') {
    const isParameterSelection = item.parentKind === 'method';
    const rows = item.selected.map((child) => {
      const entry = isParameterSelection ? child.param : child.property;
      return [
        entry.name,
        entry.typeRich || [entry.type],
        entry.required ? 'Required' : 'Optional',
        entry.descriptionRich?.length && entry.description ? entry.descriptionRich : (entry.description || '—'),
      ];
    });
    const table = tableBlock(
      [isParameterSelection ? 'Parameter' : 'Field', 'Type', 'Required', 'Description'],
      rows,
      rows.length + (isParameterSelection ? ' parameter(s)' : ' field(s)')
    );
    blocks.push(tableDetails(isParameterSelection ? 'Selected parameters' : 'Selected fields', table, rows.length));
  } else if (item.kind === 'parameter' || item.kind === 'field') {
    const isParameter = item.kind === 'parameter';
    const entry = isParameter ? item.param : item.property;
    const label = isParameter ? 'Parameter' : 'Field';
    const rows = [[
      entry.name,
      entry.typeRich || [entry.type],
      entry.required ? 'Required' : 'Optional',
      entry.descriptionRich?.length && entry.description ? entry.descriptionRich : (entry.description || '—'),
    ]];
    blocks.push(heading(label + ' details', 4));
    blocks.push(tableBlock([label, 'Type', 'Required', 'Description'], rows, '1 ' + label.toLowerCase()));
  }

  blocks.push({ type: 'divider' });
  blocks.push({ type: 'footer', text: [
    'Telegram Bot API ' + version + ' · ',
    richTextLink('Documentation', item.url || item.parentUrl || API_DOCS_URL),
  ] });
  return blocks;
}

export function getInlineHelpResult() {
  return {
    type: 'article',
    id: 'inline-help',
    title: 'How to use RichDocsBot',
    description: 'Search methods, parameters, and types with inline mode.',
    input_message_content: {
      rich_message: {
        blocks: [
          heading('Quick Guide', 2),
          paragraph(['Search the Telegram Bot API from any chat. Type ', { type: 'code', text: '@RichDocsBot' }, ' followed by a ', { type: 'bold', text: 'method' }, ', ', { type: 'bold', text: 'type' }, ', or ', { type: 'bold', text: 'parameter' }, ' name.']),
          {
            type: 'details',
            summary: 'Search examples',
            blocks: [
              {
                type: 'list',
                items: [
                  {
                    blocks: [
                      { type: 'paragraph', text: 'Methods' },
                      {
                        type: 'list',
                        items: [
                          { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'sendMessage' }, ' — method overview and parameters'] }] },
                          { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'sendMessage.' }, ' — list all parameters separately'] }] },
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
                          { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'ChatMember' }, ' — type overview'] }] },
                          { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'ChatMember.' }, ' — list all fields separately'] }] },
                          { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'ChatMember.status' }, ' — one field'] }] },
                          { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'User.id,first_name,username' }, ' — selected fields in one table'] }] },
                        ],
                      },
                    ],
                  },
                  {
                    blocks: [
                      { type: 'paragraph', text: 'Global parameter search' },
                      {
                        type: 'list',
                        items: [
                          { blocks: [{ type: 'paragraph', text: [{ type: 'code', text: 'chat_id' }, ' — find matching parameters across methods'] }] },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  };
}

export function getNoResultsResult() {
  return {
    type: 'article',
    id: 'no-results-found',
    title: 'No results found',
    description: 'Try a method, type, or parameter name.',
    input_message_content: {
      rich_message: {
        blocks: [
          heading('No results found', 2),
        ],
      },
    },
  };
}

export function toInlineResult(item, index, version) {
  if (item.kind === 'help') return getInlineHelpResult();
  const summary = item.kind === 'method'
    ? (item.category || 'Bot API') + ' · Method' + (item.returns ? ' · Returns ' + item.returns : '')
    : item.kind === 'type'
      ? 'Type / object · ' + (item.properties?.length || 0) + ' field(s)'
      : item.kind === 'parameter'
        ? 'Parameter of ' + item.parentName + ' · ' + (item.param.required ? 'Required' : 'Optional')
        : item.kind === 'field'
          ? 'Field of ' + item.parentName + ' · ' + item.property.type
          : item.kind === 'selection'
            ? item.selected.length + ' selected fields from ' + item.parentName
            : 'Telegram Bot API documentation';
  return {
    type: 'article',
    id: (item.kind + ':' + item.name).slice(0, 64) || String(index),
    title: item.title.slice(0, 256),
    description: (item.description || summary).slice(0, 256),
    input_message_content: {
      rich_message: {
        blocks: renderDocBlocks(item, version),
      },
    },
  };
}

export function getFallbackResult() {
  return {
    type: 'article',
    id: 'schema-unavailable',
    title: 'Telegram Bot API documentation is temporarily unavailable',
    description: 'Please try again shortly.',
    input_message_content: {
      rich_message: {
        blocks: [
          heading('Documentation temporarily unavailable', 2),
          paragraph('RichDocsBot could not download the official Bot API schema. Please try the inline query again in a moment.'),
          { type: 'paragraph', text: [richTextLink('Open the official Bot API docs', API_DOCS_URL)] },
        ],
      },
    },
  };
}