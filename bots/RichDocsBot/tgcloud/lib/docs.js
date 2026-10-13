import { fetch } from 'sdk';

export const API_SCHEMA_URL = 'https://corefork.telegram.org/bots/api.json';
export const API_DOCS_URL = 'https://core.telegram.org/bots/api';
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_QUERY_RESULTS = 10;
const MAX_TABLE_ROWS = 18;

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

function refName(ref = '') {
  return ref.startsWith('#/components/schemas/') ? ref.slice('#/components/schemas/'.length) : '';
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

export async function searchDocs(rawQuery = '') {
  const index = await getIndex();
  const query = String(rawQuery).trim().replace(/^\/+/, '').toLowerCase();
  const tokens = query.split(/\s+/).filter(Boolean);
  let ranked = index.items.map((item) => ({ item, score: query ? scoreItem(item, query, tokens) : 0 }));
  if (query && tokens.length === 1) {
    const directMatches = ranked.filter(({ item }) => item.name.toLowerCase() === query || item.name.toLowerCase().startsWith(query));
    if (directMatches.length) ranked = directMatches;
  }
  const results = ranked
    .filter(({ item, score }) => query ? score > 0 : item.kind === 'method' && ['sendMessage', 'sendRichMessage', 'answerInlineQuery', 'getMe', 'getChat'].includes(item.name))
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, MAX_QUERY_RESULTS)
    .map(({ item }) => item);
  return { version: index.version, results };
}

function richTextLink(text, url) {
  return { type: 'url', text, url };
}

function tableBlock(headers, rows, caption) {
  const cells = [headers, ...rows].map((row, rowIndex) => row.map((value) => ({
    text: String(value ?? '—'),
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
    paragraph(item.description || 'No description is available in the current schema.'),
    { type: 'paragraph', text: [{ type: 'bold', text: 'Category: ' }, item.category || (item.kind === 'method' ? 'Bot API method' : 'Types and objects')] },
  ];

  if (item.kind === 'method') {
    if (item.params.length) {
      blocks.push(heading('Parameters', 4));
      const rows = item.params.slice(0, MAX_TABLE_ROWS).map((param) => [param.name, param.type, param.required ? 'Required' : 'Optional', param.description || '—']);
      blocks.push(tableBlock(['Parameter', 'Type', 'Required', 'Description'], rows, item.params.length + ' parameter(s)'));
      if (item.params.length > MAX_TABLE_ROWS) blocks.push(paragraph('Showing the first ' + MAX_TABLE_ROWS + ' of ' + item.params.length + ' parameters.'));
    }
    if (item.returns) {
      blocks.push(heading('Return type', 4));
      blocks.push({ type: 'paragraph', text: [richTextLink(item.returns, API_DOCS_URL + '#' + item.returns.toLowerCase())] });
    }
  } else {
    if (item.variants?.length) {
      blocks.push(heading('Variants', 4));
      blocks.push({
        type: 'list',
        items: item.variants.slice(0, MAX_TABLE_ROWS).map((variant) => ({
          blocks: [{ type: 'paragraph', text: [richTextLink(variant, API_DOCS_URL + '#' + variant.toLowerCase())] }],
        })),
      });
    }
    if (item.properties?.length) {
      blocks.push(heading('Fields', 4));
      const rows = item.properties.slice(0, MAX_TABLE_ROWS).map((property) => [property.name, property.type, property.required ? 'Required' : 'Optional', property.description || '—']);
      blocks.push(tableBlock(['Field', 'Type', 'Required', 'Description'], rows, item.properties.length + ' field(s)'));
      if (item.properties.length > MAX_TABLE_ROWS) blocks.push(paragraph('Showing the first ' + MAX_TABLE_ROWS + ' of ' + item.properties.length + ' fields.'));
    }
  }

  blocks.push({ type: 'divider' });
  blocks.push({ type: 'paragraph', text: [richTextLink('Open the official documentation', item.url || API_DOCS_URL)] });
  blocks.push({ type: 'footer', text: 'Source: Telegram Bot API ' + version + ' · RichDocsBot' });
  return blocks;
}

export function toInlineResult(item, index, version) {
  const summary = item.kind === 'method'
    ? (item.category || 'Bot API') + ' · Method' + (item.returns ? ' · Returns ' + item.returns : '')
    : 'Type / object · ' + (item.properties?.length || 0) + ' field(s)';
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
