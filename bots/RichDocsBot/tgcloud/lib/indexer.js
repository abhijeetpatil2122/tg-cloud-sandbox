import { API_DOCS_URL, TYPE_LABELS } from './config.js';
import { cleanText, richTextFromDescription, normalizeDocUrl } from './rich-text.js';
import { isPrimitiveAlias, propertyType, resolveSchema, typeRichText, refName } from './schema-utils.js';

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

export function buildIndex(document) {
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