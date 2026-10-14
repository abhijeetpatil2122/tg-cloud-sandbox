// Shared configuration for Bot API schema retrieval and inline search.
export const API_SCHEMA_URL = 'https://corefork.telegram.org/bots/api.json';
export const API_DOCS_URL = 'https://core.telegram.org/bots/api';
export const CACHE_TTL_MS = 10 * 60 * 1000;
export const MAX_QUERY_RESULTS = 50;

export const PRIMITIVE_TYPES = new Set(['integer', 'number', 'string', 'boolean', 'array', 'null']);
export const TYPE_LABELS = {
  integer: 'Integer',
  number: 'Float',
  string: 'String',
  boolean: 'Boolean',
  array: 'Array',
  object: 'Object',
  null: 'null',
};
