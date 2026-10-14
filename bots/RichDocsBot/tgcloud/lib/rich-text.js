import { API_DOCS_URL } from './config.js';

export function cleanText(value = '') {
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

export function normalizeDocUrl(url = '') {
  const value = String(url).trim();
  if (!value) return API_DOCS_URL;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('#')) return API_DOCS_URL + '#' + value.slice(1).toLowerCase();
  if (value.startsWith('/')) return 'https://core.telegram.org' + value;
  return API_DOCS_URL + '#' + value.replace(/^#/, '').toLowerCase();
}

export function richTextFromDescription(value = '') {
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

export function richTextLink(text, url, style = 'primary') {
  return {
    type: 'button',
    button: {
      text: String(text),
      url: String(url || API_DOCS_URL),
      ...(style ? { style } : {}),
    },
  };
}

export function paragraph(text) {
  return { type: 'paragraph', text: text || 'No description is available in the schema.' };
}

export function heading(text, size = 4) {
  return { type: 'heading', size, text };
}
