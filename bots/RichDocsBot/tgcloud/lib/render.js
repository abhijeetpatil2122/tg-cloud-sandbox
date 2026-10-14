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

function paragraph(text) {
  return { type: 'paragraph', text: text || 'No description is available in the schema.' };
}

function heading(text, size = 4) {
  return { type: 'heading', size, text };
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
    description: 'Search methods, parameters, and types. Example: sendMessage, chat_id, ChatMember.',
    input_message_content: {
      rich_message: {
        blocks: [
          heading('RichDocsBot · Quick guide', 2),
          paragraph('Search the official Telegram Bot API directly from any chat using inline mode.'),
          heading('Search examples', 4),
          { type: 'list', items: [
            { blocks: [{ type: 'paragraph', text: ['Method: ', { type: 'code', text: 'sendMessage' }] }] },
            { blocks: [{ type: 'paragraph', text: ['Parameter: ', { type: 'code', text: 'chat_id' }] }] },
            { blocks: [{ type: 'paragraph', text: ['Type or object: ', { type: 'code', text: 'ChatMember' }] }] },
            { blocks: [{ type: 'paragraph', text: ['All fields: ', { type: 'code', text: 'sendMessage.' }] }] },
            { blocks: [{ type: 'paragraph', text: ['Selected fields: ', { type: 'code', text: 'sendMessage.text,parse_mode' }] }] },
          ] },
          paragraph('Search a method or type by name. Add a trailing dot to list its fields, or select fields with commas. Scroll to browse more methods.'),
          { type: 'paragraph', text: [richTextLink('Official Telegram Bot API documentation', API_DOCS_URL)] },
          { type: 'footer', text: 'RichDocsBot · Official Bot API schema search' },
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