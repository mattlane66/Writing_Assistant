'use strict';
const { PRIMITIVES } = require('./framework');
const text = { type: 'string', minLength: 1 };
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const nullable = schema => ({ anyOf: [{ type: 'null' }, schema] });
const statuses = { type: 'string', enum: ['violation', 'pressure', 'pass'] };
const primitives = { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', enum: Object.keys(PRIMITIVES) } };
const repair = object({ text, why: text });
const suggestion = object({ label: text, text, why: text });
const common = {
  id: { ...text, maxLength: 80, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', description: 'Unique across span and whole-passage findings.' },
  status: statuses, primitives, diagnosis: text, question: text, think_first: text,
  context_condition: nullable(text), keep: nullable(repair),
  suggestions: { type: 'array', maxItems: 8, items: suggestion }
};
const required = ['id', 'status', 'primitives', 'diagnosis', 'question', 'think_first'];
const span = object({ ...common, quote: text, occurrence: { type: 'integer', minimum: 1 } }, [...required, 'quote']);
const whole = object(common, required);
const DIAGNOSTIC_INPUT = object({
  passage: { ...text, maxLength: 50000, description: 'Original passage, preserved verbatim.' },
  findings: { type: 'array', maxItems: 80, items: span },
  whole_passage_checks: { type: 'array', maxItems: 20, items: whole }
}, ['passage', 'findings']);
const families = { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', enum: ['seeing', 'truth', 'reasoning', 'sentence', 'piece', 'honesty'] } };
const outputCommon = { ...common, families, context_condition: nullable(text), keep: nullable(repair), scope: { type: 'string', enum: ['span', 'whole'] } };
const spanOutput = object({ ...outputCommon, scope: { type: 'string', enum: ['span'] }, quote: text, occurrence: { type: 'integer', minimum: 1 }, start: { type: 'integer', minimum: 0 }, end: { type: 'integer', minimum: 1 } });
const wholeOutput = object({ ...outputCommon, scope: { type: 'string', enum: ['whole'] } });
const count = { type: 'integer', minimum: 0 };
const DIAGNOSTIC_OUTPUT = object({
  version: text, standard: text, passage: { ...text, maxLength: 50000 },
  findings: { type: 'array', maxItems: 80, items: spanOutput },
  whole_passage_checks: { type: 'array', maxItems: 20, items: wholeOutput },
  summary: object({ total: count, violation: count, pressure: count, pass: count })
});
const FRAMEWORK_OUTPUT = object({
  standard: text, statuses: object({ violation: text, pressure: text, pass: text }),
  repair_order: { type: 'array', minItems: 3, maxItems: 3, items: text },
  primitives: { type: 'array', minItems: 18, maxItems: 18, items: object({ name: text, family: { type: 'string', enum: families.items.enum }, question: text }) }
});
const EMPTY_INPUT = object({});
module.exports = { DIAGNOSTIC_INPUT, DIAGNOSTIC_OUTPUT, FRAMEWORK_OUTPUT, EMPTY_INPUT };
