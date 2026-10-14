// Public documentation API used by the inline-query handler.
// Implementation is split by responsibility so future data sources (such as
// errors.json) can be added without coupling retrieval, search, and rendering.
export { searchDocs } from './search.js';
export { toInlineResult, getInlineHelpResult, getFallbackResult, renderDocBlocks } from './render.js';
