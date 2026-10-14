import { PRIMITIVE_TYPES, TYPE_LABELS } from './config.js';
import { normalizeDocUrl, richTextLink } from './rich-text.js';

export function refName(ref = '') {
  return ref.startsWith('#/components/schemas/') ? ref.slice('#/components/schemas/'.length) : '';
}


export function isPrimitiveAlias(schema, schemas, depth = 0) {
  if (!schema || depth > 8) return false;
  if (schema.$ref) return isPrimitiveAlias(schemas[refName(schema.$ref)], schemas, depth + 1);
  if (schema.type && PRIMITIVE_TYPES.has(schema.type) && !schema.properties) return true;
  const choices = schema.anyOf || schema.oneOf;
  return Array.isArray(choices) && choices.length > 0 &&
    choices.every((choice) => isPrimitiveAlias(choice, schemas, depth + 1));
}

export function typeRichText(property, schemas, depth = 0) {
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

export function resolveSchema(schema, schemas, depth = 0) {
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

export function responseType(operation, schemas) {
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

export function propertyType(property, schemas, depth = 0) {
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