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
    if (label) parts.push({ type: 'url', text: label, url: normalizeDocUrl(target) });
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

function typeRichText(property, schemas, depth = 0) {
  if (!property || depth > 8) return ['Any'];
  if (property.$ref) {
    const name = refName(property.$ref);
    return name ? [{ type: 'url', text: name, url: normalizeDocUrl('#' + name.toLowerCase()) }] : ['Object'];
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
  return [property.type || 'Object'];
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
  return refName(resultRef) || refName(schema.$ref) || '';
}

function propertyType(property, schemas) {
  if (!property) return 'Any';
  if (property.$ref) return refName(property.$ref) || 'Object';
  if (property.type === 'array') return propertyType(property.items, schemas) + '[]';
  if (property.anyOf || property.oneOf) {
    const choices = property.anyOf || property.oneOf;
    return choices.map((choice) => choice.$ref ? refName(choice.$ref) : choice.type || 'Any').join(' | ');
  }
  if (property.enum) return property.enum.join(' | ');
  return property.type || 'Object';
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
      .map((variant) => variant.$ref ? refName(variant.$ref) : variant.type || '')
      .filter(Boolean);
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
      searchText: (name + ' ' + description + ' ' + variants.join(' ') + ' ' +
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
    const popularNames = ['sendMessage', 'sendRichMessage', 'answerInlineQuery', 'getMe', 'getChat'];
    const popular = popularNames.map((name) => index.items.find((item) => item.kind === 'method' && item.name === name)).filter(Boolean);
    return page([{
      kind: 'help',
      name: 'inline-help',
      title: 'How to use RichDocsBot',
      description: 'Quick guide to searching the Telegram Bot API.',
    }, ...popular]);
  }

  const dotted = originalQuery.match(/^([^.]+)\.(.*)$/);
  let parentName = '';
  let childFilter = null;
  let childrenOnly = false;
  if (dotted) {
    parentName = dotted[1].trim().toLowerCase();
    childFilter = dotted[2].trim().toLowerCase();
    childrenOnly = true;
  } else if (tokens.length >= 2) {
    const candidate = index.items.find((item) => item.name.toLowerCase() === tokens[0]);
    if (candidate && (candidate.kind === 'method' || candidate.kind === 'type')) {
      parentName = candidate.name.toLowerCase();
      childFilter = tokens.slice(1).join(' ').toLowerCase();
      childrenOnly = true;
    }
  }

  if (parentName) {
    const parent = index.items.find((item) => item.name.toLowerCase() === parentName && (item.kind === 'method' || item.kind === 'type'));
    if (parent) {
      const children = createChildItems(parent);
      const filtered = !childFilter || childFilter === '*'
        ? children
        : children.filter((item) => item.childName.toLowerCase() === childFilter || item.childName.toLowerCase().startsWith(childFilter) || item.childName.toLowerCase().includes(childFilter));
      return page(filtered);
    }
  }

  const exact = index.items.find((item) => item.name.toLowerCase() === query);
  if (exact && (exact.kind === 'method' || exact.kind === 'type')) {
    return page([exact, ...createChildItems(exact)]);
  }

  const ranked = index.items.map((item) => ({ item, score: scoreItem(item, query, tokens) }));
  if (tokens.length === 1) {
    const directMatches = ranked.filter(({ item }) => item.name.toLowerCase() === query || item.name.toLowerCase().startsWith(query));
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
  return { type: 'url', text, url };
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
  const blocks = [
    heading(item.title, 2),
    paragraph(item.descriptionRich?.length ? item.descriptionRich : (item.description || 'No description is available in the current schema.')),
    { type: 'paragraph', text: [{ type: 'bold', text: 'Category: ' }, item.category || (item.kind === 'method' ? 'Bot API method' : 'Types and objects')] },
  ];

  if (item.kind === 'method') {
    if (item.params.length) {
      blocks.push(heading('Parameters', 4));
      blocks.push(paragraph(item.params.length + ' parameters are available as separate results below. Search "' + item.name + '.*" to list them all, or "' + item.name + '.question" (replace question with a parameter name) to inspect one.'));
    }
    if (item.returns) {
      blocks.push(heading('Return type', 4));
      blocks.push({ type: 'paragraph', text: [richTextLink(item.returns, API_DOCS_URL + '#' + item.returns.toLowerCase())] });
    }
  } else if (item.kind === 'type') {
    if (item.variants?.length) {
      blocks.push(heading('Variants', 4));
      blocks.push({
        type: 'list',
        items: item.variants.map((variant) => ({
          blocks: [{ type: 'paragraph', text: [richTextLink(variant, API_DOCS_URL + '#' + variant.toLowerCase())] }],
        })),
      });
    }
    if (item.properties?.length) {
      blocks.push(heading('Fields', 4));
      blocks.push(paragraph(item.properties.length + ' fields are available as separate results below. Search "' + item.name + '.*" to list them all, or "' + item.name + '.status" (replace status with a field name) to inspect one.'));
    }
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
    blocks.push(tableBlock([label, 'Type', 'Required', 'Description'], rows));
    if (isParameter) {
      blocks.push({ type: 'paragraph', text: [richTextLink('Open ' + item.parentName + ' documentation', item.parentUrl || API_DOCS_URL)] });
    } else {
      blocks.push({ type: 'paragraph', text: [richTextLink('Open ' + item.parentName + ' documentation', item.parentUrl || API_DOCS_URL)] });
    }
  }

  blocks.push({ type: 'divider' });
  blocks.push({ type: 'paragraph', text: [richTextLink('Open the official documentation', item.url || item.parentUrl || API_DOCS_URL)] });
  blocks.push({ type: 'footer', text: 'Source: Telegram Bot API ' + version + ' · RichDocsBot' });
  return blocks;
}

export function getInlineHelpResult
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
          ] },
          paragraph('Type @RichDocsBot followed by a name or keyword, then select a result to send its formatted documentation. Scroll the results to load more matches.'),
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
