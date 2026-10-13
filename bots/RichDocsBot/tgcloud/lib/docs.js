import { fetch } from 'sdk';

export const API_SCHEMA_URL = 'https://corefork.telegram.org/bots/api.json';
export const API_DOCS_URL = 'https://core.telegram.org/bots/api';
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_QUERY_RESULTS = 50;

let cachedIndex;
let cachedAt = 0;
let inFlight;

function cleanText(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/!?\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\x60([^\x60]+)\x60/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDocUrl(url = '') {
  const value = String(url).trim();
  if (!value) return API_DOCS_URL;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('#')) return API_DOCS_URL + '#' + value.slice(1).toLowerCase();
  if (value.startsWith('/')) return 'https://core.telegram.org' + value;
  return API_DOCS_URL + '#' + value.replace(/^#/, '').toLowerCase();
}

function richTextFromDescription(value = '') {
  const source = String(value || '');
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const parts = [];

  function appendPlain(raw) {
    const text = cleanText(raw);
    if (!text) return;
    const leadingSpace = /\s/.test(raw[0] || '');
    const trailingSpace = /\s/.test(raw[raw.length - 1] || '');
    let value = text;
    if (parts.length && leadingSpace) value = ' ' + value;
    if (trailingSpace) value += ' ';
    parts.push(value);
  }

  let cursor = 0;
  let match;
  while ((match = pattern.exec(source))) {
    appendPlain(source.slice(cursor, match.index));
    const label = cleanText(match[1] ?? match[4] ?? '');
    const target = match[2] ?? match[3] ?? '';
    if (label) parts.push(richTextLink(label, normalizeDocUrl(target)));
    cursor = pattern.lastIndex;
  }
  appendPlain(source.slice(cursor));

  if (!parts.length) {
    const plain = cleanText(source);
    return plain ? [plain] : [];
  }
  if (typeof parts[0] === 'string') parts[0] = parts[0].replace(/^\s+/, '');
  if (typeof parts[parts.length - 1] === 'string') parts[parts.length - 1] = parts[parts.length - 1].replace(/\s+$/, '');
  return parts.filter((part) => typeof part !== 'string' || part.length > 0);
}

function refName(ref = '') {
  return ref.startsWith('#/components/schemas/') ? ref.slice('#/components/schemas/'.length) : '';
}

const PRIMITIVE_TYPES = new Set(['integer', 'number', 'string', 'boolean', 'array', 'null']);
const TYPE_LABELS = { integer: 'Integer', number: 'Float', string: 'String', boolean: 'Boolean', array: 'Array', object: 'Object', null: 'null' };

function isPrimitiveAlias(schema, schemas, depth = 0) {
  if (!schema || depth > 8) return false;
  if (schema.$ref) return isPrimitiveAlias(schemas[refName(schema.$ref)], schemas, depth + 1);
  if (schema.type && PRIMITIVE_TYPES.has(schema.type) && !schema.properties) return true;
  const choices = schema.anyOf || schema.oneOf;
  return Array.isArray(choices) && choices.length > 0 &&
    choices.every((choice) => isPrimitiveAlias(choice, schemas, depth + 1));
}

function typeRichText(property, schemas, depth = 0) {
  if (!property || depth > 8) return ['Any'];
  if (property.$ref) {
    const name = refName(property.$ref);
    const target = name ? schemas[name] : null;
    // Primitive aliases such as ChatId are implementation details, not
    // documented objects. Expand them into their real API types instead of
    // creating broken links like #chatid.
    if (target && isPrimitiveAlias(target, schemas, depth + 1)) {
      return typeRichText(target, schemas, depth + 1);
    }
    if (name && target && (target.description || target.properties ||
        target.oneOf || target.anyOf || target.allOf)) {
      return [richTextLink(name, normalizeDocUrl('#' + name.toLowerCase()))];
    }
    return [name || 'Object'];
  }
  if (property.type === 'array') return [...typeRichText(property.items, schemas, depth + 1), '[]'];
  const choices = property.anyOf || property.oneOf;
  if (Array.isArray(choices) && choices.length) {
    const output = [];
    choices.forEach((choice, index) => {
      if (index) output.push(' | ');
      output.push(...typeRichText(choice, schemas, depth + 1));
    });
    return output;
  }
  if (Array.isArray(property.enum)) return [property.enum.join(' | ')];
  return [TYPE_LABELS[property.type] || property.type || 'Object'];
}

function resolveSchema(schema, schemas, depth = 0) {
  if (!schema || depth > 8) return {};
  if (schema.$ref) return resolveSchema(schemas[refName(schema.$ref)], schemas, depth + 1);
  if (Array.isArray(schema.allOf)) {
    return schema.allOf.reduce((out, part) => {
      const resolved = resolveSchema(part, schemas, depth + 1);
      return {
        ...out,
        ...resolved,
        properties: { ...(out.properties || {}), ...(resolved.properties || {}) },
        required: [...new Set([...(out.required || []), ...(resolved.required || [])])],
      };
    }, { ...schema, properties: { ...(schema.properties || {}) }, required: [...(schema.required || [])] });
  }
  return schema;
}

function responseType(operation, schemas) {
  const response = operation?.responses?.['200'] || operation?.responses?.['201'];
  const content = response?.content || {};
  const media = content['application/json'] || content['application/json; charset=utf-8'] || Object.values(content)[0];
  const schema = media?.schema;
  if (!schema) return '';
  const resolved = resolveSchema(schema, schemas);
  const resultRef = resolved?.properties?.result?.$ref;
  const name = refName(resultRef) || refName(schema.$ref) || '';
  if (!name) return '';
  const target = schemas[name];
  if (target && isPrimitiveAlias(target, schemas)) return propertyType(target, schemas);
  return name;
}

function propertyType(property, schemas, depth = 0) {
  if (!property || depth > 8) return 'Any';
  if (property.$ref) {
    const name = refName(property.$ref);
    const target = name ? schemas[name] : null;
    if (target && isPrimitiveAlias(target, schemas, depth + 1)) {
      return propertyType(target, schemas, depth + 1);
    }
    return name || 'Object';
  }
  if (property.type === 'array') return propertyType(property.items, schemas, depth + 1) + '[]';
  const choices = property.anyOf || property.oneOf;
  if (Array.isArray(choices) && choices.length) {
    return choices.map((choice) => propertyType(choice, schemas, depth + 1)).join(' | ');
  }
  if (property.enum) return property.enum.join(' | ');
  return TYPE_LABELS[property.type] || property.type || 'Object';
}

function operationParams(operation, schemas) {
  const content = operation?.requestBody?.content || {};
  const media = content['application/json'] || content['multipart/form-data'] || Object.values(content)[0];
  const raw = media?.schema || {};
  const resolved = resolveSchema(raw, schemas);
  const required = new Set(resolved.required || []);
  const properties = resolved.properties || {};
  return Object.entries(properties).map(([name, property]) => ({
    name,
    type: propertyType(property, schemas),
    required: required.has(name),
    description: cleanText(property.description || ''),
    descriptionRich: richTextFromDescription(property.description || ''),
    typeRich: typeRichText(property, schemas),
    raw: property,
  }));
}

function buildIndex(document) {
  const schemas = document.components?.schemas || {};
  const items = [];

  for (const [path, pathItem] of Object.entries(document.paths || {})) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const operation of Object.values(pathItem)) {
      if (!operation || typeof operation !== 'object' || !operation.operationId) continue;
      const name = operation.operationId;
      const description = cleanText(operation.description || operation.summary || '');
      const params = operationParams(operation, schemas);
      const category = (operation.tags || []).join(', ');
      const returns = responseType(operation, schemas);
      const returnsLink = Boolean(returns && schemas[returns] && !isPrimitiveAlias(schemas[returns], schemas));
      items.push({
        kind: 'method',
        name,
        title: name,
        category,
        description,
        descriptionRich: richTextFromDescription(operation.description || operation.summary || ''),
        path,
        params,
        returns,
        returnsLink,
        url: API_DOCS_URL + '#' + name.toLowerCase(),
        searchText: (name + ' ' + category + ' ' + description + ' ' + path + ' ' +
          params.map((p) => p.name + ' ' + p.type + ' ' + p.description).join(' ') + ' ' + returns).toLowerCase(),
      });
    }
  }

  for (const [name, rawSchema] of Object.entries(schemas)) {
    if (!rawSchema || typeof rawSchema !== 'object' || /(?:Params|Response)$/.test(name)) continue;
    const schema = resolveSchema(rawSchema, schemas);
    const properties = Object.entries(schema.properties || {}).map(([propertyName, property]) => ({
      name: propertyName,
      type: propertyType(property, schemas),
      required: (schema.required || []).includes(propertyName),
      description: cleanText(property.description || ''),
      descriptionRich: richTextFromDescription(property.description || ''),
      typeRich: typeRichText(property, schemas),
      raw: property,
    }));
    if (!properties.length && !rawSchema.description) continue;
    const description = cleanText(rawSchema.description || schema.description || '');
    const variants = (rawSchema.oneOf || rawSchema.anyOf || schema.oneOf || schema.anyOf || [])
      .map((variant) => {
        if (variant.$ref) {
          const variantName = refName(variant.$ref);
          const target = variantName ? schemas[variantName] : null;
          if (target && isPrimitiveAlias(target, schemas)) {
            return { name: propertyType(target, schemas), url: '' };
          }
          return {
            name: variantName,
            url: variantName && target && (target.description || target.properties ||
              target.oneOf || target.anyOf || target.allOf)
              ? normalizeDocUrl('#' + variantName.toLowerCase())
              : '',
          };
        }
        return { name: TYPE_LABELS[variant.type] || variant.type || '', url: '' };
      })
      .filter((variant) => variant.name);
    items.push({
      kind: 'type',
      name,
      title: name,
      category: 'Types and objects',
      description,
      descriptionRich: richTextFromDescription(rawSchema.description || schema.description || ''),
      properties,
      variants,
      url: API_DOCS_URL + '#' + name.toLowerCase(),
      searchText: (name + ' ' + description + ' ' + variants.map((variant) => variant.name).join(' ') + ' ' +
        properties.map((p) => p.name + ' ' + p.type + ' ' + p.description).join(' ')).toLowerCase(),
    });
  }

  return { version: document.info?.version || 'unknown', items };
}

async function getIndex() {
  const now = Date.now();
  if (cachedIndex && now - cachedAt < CACHE_TTL_MS) return cachedIndex;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const response = await fetch(API_SCHEMA_URL, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error('Bot API schema request failed (' + response.status + ')');
    const document = await response.json();
    if (!document?.paths || !document?.components?.schemas) throw new Error('The Bot API schema response has an unexpected shape');
    cachedIndex = buildIndex(document);
    cachedAt = Date.now();
    return cachedIndex;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = undefined;
  }
}

function scoreItem(item, query, tokens) {
  const name = item.name.toLowerCase();
  let score = 0;
  if (name === query) score += 120;
  else if (name.startsWith(query)) score += 75;
  else if (name.includes(query)) score += 48;
  if (item.kind === 'method' && item.params.some((p) => p.name.toLowerCase() === query)) score += 95;
  if (item.kind === 'type' && item.properties?.some((p) => p.name.toLowerCase() === query)) score += 65;
  if (item.category.toLowerCase().includes(query)) score += 12;

  let matched = 0;
  for (const token of tokens) {
    if (name.includes(token)) matched += 8;
    else if (item.searchText.includes(token)) matched += 3;
  }
  if (tokens.length && matched === 0) return 0;
  score += matched;
  if (item.kind === 'method') score += 4;
  return score;
}

export async function searchDocs(rawQuery = '', rawOffset = 0) {
  const index = await getIndex();
  const originalQuery = String(rawQuery).trim().replace(/^\/+/, '');
  const query = originalQuery.toLowerCase();
  const parsedOffset = Number.parseInt(String(rawOffset || '0'), 10);
  const offset = Number.isSafeInteger(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0;
  const tokens = query.split(/\s+/).filter(Boolean);

  function page(results) {
    return {
      version: index.version,
      results: results.slice(offset, offset + MAX_QUERY_RESULTS),
      nextOffset: offset + MAX_QUERY_RESULTS < results.length ? String(offset + MAX_QUERY_RESULTS) : '',
    };
  }

  if (!query) {
    const methods = index.items.filter((item) => item.kind === 'method')
      .sort((a, b) => a.name.localeCompare(b.name));
    return page([{
      kind: 'help',
      name: 'inline-help',
      title: 'How to use RichDocsBot',
      description: 'Quick guide to searching the Telegram Bot API.',
    }, ...methods]);
  }

  // Scoped search: Parent. lists children, Parent.field selects one, and
  // Parent.field1,field2 creates one article containing only those fields.
  const dotIndex = originalQuery.indexOf('.');
  if (dotIndex >= 0) {
    const parentQuery = originalQuery.slice(0, dotIndex).trim().toLowerCase();
    const suffix = originalQuery.slice(dotIndex + 1).trim();
    const parent = index.items.find((item) =>
      item.name.toLowerCase() === parentQuery && (item.kind === 'method' || item.kind === 'type')
    );

    if (parent) {
      const children = createChildItems(parent);
      const selectedNames = suffix
        .split(',')
        .map((name) => name.trim().replace(/^\*$/, '*').toLowerCase())
        .filter(Boolean);

      // A trailing dot (or legacy wildcard) lists all child articles.
      if (!selectedNames.length || (selectedNames.length === 1 && selectedNames[0] === '*')) {
        return page(children);
      }

      const requested = selectedNames.filter((name) => name !== '*');
      const selected = requested.map((name) =>
        children.find((child) => child.childName.toLowerCase() === name)
      ).filter(Boolean);

      if (!selected.length) return page([]);

      // Multiple explicitly selected fields are combined into one compact table.
      if (requested.length > 1) {
        return page([{
          kind: 'selection',
          name: parent.name + '.' + requested.join(','),
          title: parent.name + ' · ' + selected.map((child) => child.childName).join(', '),
          category: parent.category || 'Types and objects',
          parentName: parent.name,
          parentUrl: parent.url,
          parentKind: parent.kind,
          selected,
          url: parent.url,
          description: '',
        }]);
      }

      // A single explicit field returns only its own article.
      return page(selected.slice(0, 1));
    }
  }

  // Keep the exact article first, but include other matching method/type names.
  // For example, sendMessage should also discover sendRichMessage.
  const exact = index.items.find((item) => item.name.toLowerCase() === query);
  if (exact && (exact.kind === 'method' || exact.kind === 'type')) {
    const related = index.items.filter((item) => item !== exact &&
      (item.kind === 'method' || item.kind === 'type') &&
      (item.name.toLowerCase().includes(query) ||
        (exact.kind === 'method' && item.kind === 'method' &&
          item.name.toLowerCase().includes(query.replace(/^send/, ''))))
    );
    related.sort((a, b) => a.name.localeCompare(b.name));
    return page([exact, ...related]);
  }

  // Global exact parameter/property lookup remains available without a parent prefix.
  const matchingChildren = index.items
    .filter((item) => item.kind === 'method' || item.kind === 'type')
    .flatMap((item) => createChildItems(item))
    .filter((item) => item.childName.toLowerCase() === query);
  if (matchingChildren.length) return page(matchingChildren);

  const ranked = index.items.map((item) => ({ item, score: scoreItem(item, query, tokens) }));
  if (tokens.length === 1) {
    const directMatches = ranked.filter(({ item }) =>
      item.name.toLowerCase() === query || item.name.toLowerCase().startsWith(query)
    );
    if (directMatches.length) {
      directMatches.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
      return page(directMatches.map(({ item }) => item));
    }
  }

  const matches = ranked
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .map(({ item }) => item);
  return page(matches);
}

function createChildItems(parent) {
  if (parent.kind === 'method') {
    return (parent.params || []).map((param) => ({
      kind: 'parameter',
      name: parent.name + '.' + param.name,
      childName: param.name,
      title: parent.name + ' · ' + param.name,
      category: parent.category || 'Bot API method',
      description: param.description,
      descriptionRich: param.descriptionRich,
      parentName: parent.name,
      parentUrl: parent.url,
      parentTitle: parent.title,
      param,
      searchText: (parent.name + ' ' + param.name + ' ' + param.type + ' ' + param.description).toLowerCase(),
    }));
  }
  if (parent.kind === 'type') {
    return (parent.properties || []).map((property) => ({
      kind: 'field',
      name: parent.name + '.' + property.name,
      childName: property.name,
      title: parent.name + ' · ' + property.name,
      category: 'Field of ' + parent.name,
      description: property.description,
      descriptionRich: property.descriptionRich,
      parentName: parent.name,
      parentUrl: parent.url,
      parentTitle: parent.title,
      property,
      searchText: (parent.name + ' ' + property.name + ' ' + property.type + ' ' + property.description).toLowerCase(),
    }));
  }
  return [];
}

function richTextLink(text, url) {
  return {
    type: 'button',
    button: {
      text: String(text),
      url: String(url || API_DOCS_URL),
      style: 'primary',
    },
  };
}

function tableBlock(headers, rows, caption) {
  const cells = [headers, ...rows].map((row, rowIndex) => row.map((value) => ({
    text: Array.isArray(value) ? value : String(value ?? '—'),
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
      blocks.push(heading('Parameters', 4));
      const rows = item.params.map((param) => [
        param.name,
        param.typeRich || [param.type],
        param.required ? 'Required' : 'Optional',
        param.descriptionRich?.length && param.description ? param.descriptionRich : (param.description || '—'),
      ]);
      blocks.push(tableBlock(['Parameter', 'Type', 'Required', 'Description'], rows, item.params.length + ' parameter(s)'));

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
      blocks.push(heading('Fields', 4));
      const rows = item.properties.map((field) => [
        field.name, field.typeRich || [field.type],
        field.required ? 'Required' : 'Optional',
        field.descriptionRich?.length && field.description ? field.descriptionRich : (field.description || '—'),
      ]);
      blocks.push(tableBlock(['Field', 'Type', 'Required', 'Description'], rows, item.properties.length + ' field(s)'));
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
    blocks.push(tableBlock(
      [isParameterSelection ? 'Parameter' : 'Field', 'Type', 'Required', 'Description'],
      rows,
      rows.length + (isParameterSelection ? ' parameter(s)' : ' field(s)')
    ));
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
