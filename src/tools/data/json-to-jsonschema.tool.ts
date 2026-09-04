import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './json-to-jsonschema.meta';

const DRAFT = 'https://json-schema.org/draft/2020-12/schema';

type Schema = Record<string, unknown>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

interface Ctx {
  requireAll: boolean;
  addlProps: boolean;
}

function schemaOf(ctx: Ctx, value: unknown): Schema {
  if (value === null) return { type: 'null' };
  if (Array.isArray(value)) {
    const out: Schema = { type: 'array' };
    if (value.length > 0) out.items = mergeSchemas(value.map((v) => schemaOf(ctx, v)));
    return out;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    const properties: Schema = {};
    for (const k of keys) properties[k] = schemaOf(ctx, value[k]);
    const out: Schema = { type: 'object', properties };
    if (ctx.requireAll && keys.length > 0) out.required = keys;
    out.additionalProperties = ctx.addlProps;
    return out;
  }
  switch (typeof value) {
    case 'string':
      return { type: 'string' };
    case 'boolean':
      return { type: 'boolean' };
    case 'number':
      return { type: Number.isInteger(value) ? 'integer' : 'number' };
    default:
      return {};
  }
}

function isTypeOnly(s: Schema): s is { type: string } {
  return Object.keys(s).length === 1 && typeof s.type === 'string';
}

function mergeSchemas(schemas: Schema[]): Schema {
  if (schemas.length === 0) return {};
  if (schemas.length === 1) return schemas[0]!;

  if (schemas.every((s) => s.type === 'object')) return mergeObjectSchemas(schemas);

  if (schemas.every((s) => s.type === 'array')) {
    const items = schemas.map((s) => s.items).filter((x): x is Schema => x !== undefined);
    const out: Schema = { type: 'array' };
    if (items.length > 0) out.items = mergeSchemas(items);
    return out;
  }

  const uniq: Schema[] = [];
  const seen = new Set<string>();
  for (const s of schemas) {
    const key = JSON.stringify(s);
    if (!seen.has(key)) {
      seen.add(key);
      uniq.push(s);
    }
  }
  if (uniq.length === 1) return uniq[0]!;

  if (uniq.every(isTypeOnly)) {
    const set = new Set(uniq.map((s) => s.type));
    if (set.size === 2 && set.has('integer') && set.has('number')) return { type: 'number' };
    return { type: [...set].sort() };
  }
  return { anyOf: uniq };
}

function mergeObjectSchemas(schemas: Schema[]): Schema {
  const propNames: string[] = [];
  const seen = new Set<string>();
  for (const s of schemas) {
    const props = isPlainObject(s.properties) ? s.properties : {};
    for (const k of Object.keys(props)) {
      if (!seen.has(k)) {
        seen.add(k);
        propNames.push(k);
      }
    }
  }

  const properties: Schema = {};
  for (const name of propNames) {
    const subs: Schema[] = [];
    for (const s of schemas) {
      const props = isPlainObject(s.properties) ? s.properties : {};
      if (Object.prototype.hasOwnProperty.call(props, name)) subs.push(props[name] as Schema);
    }
    properties[name] = mergeSchemas(subs);
  }

  const required = propNames.filter((name) =>
    schemas.every((s) => Array.isArray(s.required) && s.required.includes(name)),
  );

  const out: Schema = { type: 'object', properties };
  if (required.length > 0) out.required = required;
  if (schemas.every((s) => 'additionalProperties' in s)) {
    out.additionalProperties = schemas[0]!.additionalProperties;
  }
  return out;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text.trim()) return { output: '' };

  let value: unknown;
  try {
    value = JSON.parse(input.text);
  } catch (e) {
    throw new ToolError('Invalid JSON input.', (e as Error).message);
  }

  const ctx: Ctx = {
    requireAll: Boolean(o.requireAllProps),
    addlProps: Boolean(o.additionalProperties),
  };
  const title = String(o.title || '').trim();

  const body = schemaOf(ctx, value);
  const schema: Schema = {
    $schema: DRAFT,
    ...(title ? { title } : {}),
    ...body,
  };

  const output = JSON.stringify(schema, null, 2);
  return {
    output,
    render: 'code',
    language: 'json',
    filename: 'schema.json',
    stats: { 'output lines': output.split('\n').length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
