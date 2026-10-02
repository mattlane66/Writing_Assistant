'use strict';

// Validate the small, fixed schema vocabulary used by this package.
// Schemas are authored here, never accepted from a tool caller.
function validate(schema, value, at = 'arguments') {
  if (schema.anyOf) {
    for (const choice of schema.anyOf) {
      try { validate(choice, value, at); return; } catch (_) { /* try next shape */ }
    }
    throw new Error(`${at} must match one of its allowed shapes.`);
  }
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const matches = type => type === undefined ||
    (type === 'null' && value === null) ||
    (type === 'object' && value !== null && typeof value === 'object' && !Array.isArray(value)) ||
    (type === 'array' && Array.isArray(value)) ||
    (type === 'string' && typeof value === 'string') ||
    (type === 'boolean' && typeof value === 'boolean') ||
    (type === 'integer' && Number.isInteger(value)) ||
    (type === 'number' && typeof value === 'number' && Number.isFinite(value));
  if (!types.some(matches)) throw new Error(`${at} must be ${types.join(' or ')}.`);
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`${at} must be one of: ${schema.enum.join(', ')}.`);
  if (typeof value === 'string') {
    const size = Array.from(value).length;
    if (schema.minLength !== undefined && (size < schema.minLength || !value.trim())) throw new Error(`${at} must not be blank.`);
    if (schema.maxLength !== undefined && size > schema.maxLength) throw new Error(`${at} must be ${schema.maxLength} characters or fewer.`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) throw new Error(`${at} has an invalid format.`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) throw new Error(`${at} must be at least ${schema.minimum}.`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) throw new Error(`${at} needs at least ${schema.minItems} item(s).`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) throw new Error(`${at} permits at most ${schema.maxItems} items.`);
    if (schema.uniqueItems && new Set(value.map(x => JSON.stringify(x))).size !== value.length) throw new Error(`${at} contains duplicate items.`);
    if (schema.items) value.forEach((item, i) => validate(schema.items, item, `${at}[${i}]`));
  } else if (value !== null && typeof value === 'object') {
    const properties = schema.properties || {};
    for (const key of schema.required || []) {
      if (!Object.hasOwn(value, key)) throw new Error(`${at}.${key} is required.`);
    }
    for (const key of Object.keys(value)) {
      if (Object.hasOwn(properties, key)) validate(properties[key], value[key], `${at}.${key}`);
      else if (schema.additionalProperties === false) throw new Error(`${at}.${key} is not an allowed field.`);
    }
  }
}

module.exports = { validate };
