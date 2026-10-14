import { MAX_QUERY_RESULTS } from './config.js';
import { getIndex } from './schema-client.js';
import { createChildItems } from './search-children.js';

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