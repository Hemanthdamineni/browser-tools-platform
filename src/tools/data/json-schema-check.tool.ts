import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './json-schema-check.meta';

type Issue = { path: string; keyword: string; message: string };

const SUPPORTED = new Set([
  '$schema', '$id', 'title', 'description', 'default', 'examples', 'type', 'required', 'properties',
  'additionalProperties', 'items', 'enum', 'const', 'minimum', 'maximum', 'exclusiveMinimum',
  'exclusiveMaximum', 'multipleOf', 'minLength', 'maxLength', 'pattern', 'minItems', 'maxItems',
  'uniqueItems',
]);
const COMBINATORS = new Set(['allOf', 'anyOf', 'oneOf', 'not', 'if', 'then', 'else', '$ref', '$defs', 'definitions']);
const MAX_ISSUES = 1000;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function typeMatches(value: unknown, type: string): boolean {
  switch (type) {
    case 'null': return value === null;
    case 'object': return object(value);
    case 'array': return Array.isArray(value);
    case 'string': return typeof value === 'string';
    case 'boolean': return typeof value === 'boolean';
    case 'integer': return typeof value === 'number' && Number.isInteger(value);
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    default: return false;
  }
}

function escapePointer(part: string): string {
  return part.replace(/~/g, '~0').replace(/\//g, '~1');
}

function validate(schemaValue: unknown, document: unknown): { issues: Issue[]; unsupported: string[] } {
  const issues: Issue[] = [];
  const unsupported = new Set<string>();
  const report = (path: string, keyword: string, message: string) => {
    if (issues.length < MAX_ISSUES) issues.push({ path: path || '/', keyword, message });
  };

  const visit = (schema: unknown, value: unknown, path: string, depth: number): void => {
    if (depth > 100) {
      report(path, 'schema', 'Maximum schema nesting depth (100) exceeded.');
      return;
    }
    if (typeof schema === 'boolean') {
      if (!schema) report(path, 'false schema', 'This value is rejected by a false schema.');
      return;
    }
    if (!object(schema)) {
      report(path, 'schema', 'Schema must be an object or boolean.');
      return;
    }
    for (const keyword of Object.keys(schema)) {
      if (!SUPPORTED.has(keyword) && !COMBINATORS.has(keyword)) unsupported.add(keyword);
    }

    if (schema.type !== undefined) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      if (!types.every((type) => typeof type === 'string') || !types.length) {
        report(path, 'type', 'Schema type must be a string or non-empty array of strings.');
        return;
      }
      if (!types.some((type) => typeMatches(value, type as string))) {
        report(path, 'type', `Expected ${types.join(' or ')}, received ${value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value}.`);
        return;
      }
    }

    if (Object.hasOwn(schema, 'const') && !equalJson(value, schema.const)) report(path, 'const', 'Value does not match const.');
    if (Array.isArray(schema.enum) && !schema.enum.some((item) => equalJson(value, item))) report(path, 'enum', 'Value is not one of the allowed enum values.');

    if (object(value)) {
      if (Array.isArray(schema.required)) {
        for (const key of schema.required) {
          if (typeof key !== 'string') report(path, 'required', 'Required entries must be strings.');
          else if (!Object.hasOwn(value, key)) report(path, 'required', `Missing required property ${JSON.stringify(key)}.`);
        }
      }
      const properties = object(schema.properties) ? schema.properties : {};
      for (const [key, childSchema] of Object.entries(properties)) {
        if (Object.hasOwn(value, key)) visit(childSchema, value[key], `${path}/${escapePointer(key)}`, depth + 1);
      }
      for (const key of Object.keys(value)) {
        if (Object.hasOwn(properties, key)) continue;
        if (schema.additionalProperties === false) report(`${path}/${escapePointer(key)}`, 'additionalProperties', 'Additional property is not allowed.');
        else if (schema.additionalProperties !== undefined && schema.additionalProperties !== true) {
          visit(schema.additionalProperties, value[key], `${path}/${escapePointer(key)}`, depth + 1);
        }
      }
    }

    if (Array.isArray(value)) {
      if (schema.items !== undefined) value.forEach((item, index) => visit(schema.items, item, `${path}/${index}`, depth + 1));
      if (schema.minItems !== undefined && typeof schema.minItems === 'number' && value.length < schema.minItems) report(path, 'minItems', `Array must contain at least ${schema.minItems} items.`);
      if (schema.maxItems !== undefined && typeof schema.maxItems === 'number' && value.length > schema.maxItems) report(path, 'maxItems', `Array must contain at most ${schema.maxItems} items.`);
      if (schema.uniqueItems === true) {
        for (let i = 0; i < value.length; i++) {
          for (let j = i + 1; j < value.length; j++) {
            if (equalJson(value[i], value[j])) {
              report(`${path}/${j}`, 'uniqueItems', `Duplicates item at index ${i}.`);
              break;
            }
          }
          if (issues.length >= MAX_ISSUES) break;
        }
      }
    }

    if (typeof value === 'string') {
      const length = [...value].length;
      if (typeof schema.minLength === 'number' && length < schema.minLength) report(path, 'minLength', `String must contain at least ${schema.minLength} Unicode code points.`);
      if (typeof schema.maxLength === 'number' && length > schema.maxLength) report(path, 'maxLength', `String must contain at most ${schema.maxLength} Unicode code points.`);
      if (typeof schema.pattern === 'string') {
        try {
          if (!new RegExp(schema.pattern, 'u').test(value)) report(path, 'pattern', `String does not match pattern ${JSON.stringify(schema.pattern)}.`);
        } catch {
          report(path, 'pattern', 'Schema contains an invalid regular expression.');
        }
      }
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      if (typeof schema.minimum === 'number' && value < schema.minimum) report(path, 'minimum', `Number must be at least ${schema.minimum}.`);
      if (typeof schema.maximum === 'number' && value > schema.maximum) report(path, 'maximum', `Number must be at most ${schema.maximum}.`);
      if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) report(path, 'exclusiveMinimum', `Number must be greater than ${schema.exclusiveMinimum}.`);
      if (typeof schema.exclusiveMaximum === 'number' && value >= schema.exclusiveMaximum) report(path, 'exclusiveMaximum', `Number must be less than ${schema.exclusiveMaximum}.`);
      if (typeof schema.multipleOf === 'number' && schema.multipleOf > 0) {
        const quotient = value / schema.multipleOf;
        if (Math.abs(quotient - Math.round(quotient)) > Number.EPSILON * Math.max(1, Math.abs(quotient)) * 4) report(path, 'multipleOf', `Number must be a multiple of ${schema.multipleOf}.`);
      }
    }
  };

  visit(schemaValue, document, '', 0);
  return { issues, unsupported: [...unsupported].sort() };
}

function equalJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (typeof left === 'number' && typeof right === 'number') return left === right;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((item, index) => equalJson(item, right[index]));
  if (object(left) && object(right)) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && equalJson(left[key], right[key]));
  }
  return false;
}

function run(input: TextRunInput): TextRunResult {
  resolveOptions(meta, input.options);
  if (input.text.length > 500_000) throw new ToolError('Input is too large.', 'Provide a schema and document under 500 KB combined.');
  let payload: unknown;
  try {
    payload = JSON.parse(input.text);
  } catch (error) {
    throw new ToolError('Input must be valid JSON.', (error as Error).message);
  }
  if (!object(payload) || !Object.hasOwn(payload, 'schema') || !Object.hasOwn(payload, 'document')) {
    throw new ToolError('Provide a JSON object with schema and document properties.');
  }
  const result = validate(payload.schema, payload.document);
  const rows = result.issues.map((issue) => [issue.path, issue.keyword, issue.message]);
  return {
    output: JSON.stringify({ headers: ['JSON Pointer', 'Keyword', 'Issue'], rows }),
    render: 'table',
    stats: { valid: result.issues.length === 0 ? 'yes' : 'no', errors: result.issues.length, unsupported: result.unsupported.length },
    notes: [
      ...(result.unsupported.length ? [`Unsupported keywords are not evaluated: ${result.unsupported.join(', ')}.`] : []),
      ...(result.issues.length >= MAX_ISSUES ? [`Stopped after ${MAX_ISSUES} validation issues.`] : []),
      'This tool implements only a subset of JSON Schema; use a full validator when complete specification support is required.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
