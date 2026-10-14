// Shared configuration for Bot API schema retrieval and inline search.
export const API_SCHEMA_URL = 'https://corefork.telegram.org/bots/api.json';
export const API_DOCS_URL = 'https://core.telegram.org/bots/api';
export const API_ARTICLE_THUMBNAIL_URL = 'https://image.zaw-myo.workers.dev/file/28d9a119-6cec-4191-8e0b-4f36d96f272e';
export const NO_RESULTS_THUMBNAIL_URL = 'https://image.zaw-myo.workers.dev/file/cdaaa9d4-4ca3-4360-81a9-2795a8fce8af';
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
