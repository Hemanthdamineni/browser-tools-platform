import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './json-schema-to-typescript.meta';

const MAX_LENGTH = 1_000_000;

type Ctx = {
  unit: string;
  style: 'interface' | 'type';
  exportPrefix: string;
  readonlyProps: boolean;
  comments: boolean;
  defNames: Map<string, string>;
  stats: { declarations: number; properties: number; refs: number };
};

function isObj(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const pad = (level: number, ctx: Ctx): string => ctx.unit.repeat(Math.max(0, level));

function sanitizeTypeName(raw: string): string {
  const parts = raw
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  if (!parts.length) return 'Unnamed';
  const name = parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
  return /^[A-Za-z_]/.test(name) ? name : 'Type' + name;
}

function propertyKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function literal(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return 'unknown';
}

function unionOf(parts: string[]): string {
  const seen: string[] = [];
  for (const part of parts) if (part && !seen.includes(part)) seen.push(part);
  if (!seen.length) return 'unknown';
  if (seen.length === 1) return seen[0]!;
  return seen.join(' | ');
}

function refName(ref: string, ctx: Ctx): string {
  const match = /^#\/(?:\$defs|definitions)\/(.+)$/.exec(ref);
  if (!match) return 'unknown';
  const key = match[1]!.replace(/~1/g, '/').replace(/~0/g, '~');
  const name = ctx.defNames.get(key);
  if (!name) return 'unknown';
  ctx.stats.refs += 1;
  return name;
}

function isObjectLike(schema: Record<string, unknown>): boolean {
  if (schema.$ref !== undefined) return false;
  if (schema.enum !== undefined || schema.const !== undefined) return false;
  if (schema.anyOf !== undefined || schema.oneOf !== undefined || schema.allOf !== undefined)
    return false;
  const type = schema.type;
  if (type === 'object') return true;
  if (Array.isArray(type) && type.includes('object')) return true;
  if (type === undefined)
    return isObj(schema.properties) || schema.additionalProperties !== undefined;
  return false;
}

function objectEntries(
  schema: Record<string, unknown>,
  level: number,
  ctx: Ctx,
): { lines: string[]; propTypes: string[] } {
  const lines: string[] = [];
  const propTypes: string[] = [];
  const props = isObj(schema.properties) ? schema.properties : {};
  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((key): key is string => typeof key === 'string')
      : [],
  );

  for (const key of Object.keys(props)) {
    const propSchema = props[key];
    const type = renderType(propSchema, level + 1, ctx);
    propTypes.push(type);
    ctx.stats.properties += 1;
    if (
      ctx.comments &&
      isObj(propSchema) &&
      typeof propSchema.description === 'string' &&
      propSchema.description.trim()
    ) {
      const doc = propSchema.description.trim().replace(/\*\//g, '*\\/').replace(/\s+/g, ' ');
      lines.push(`${pad(level + 1, ctx)}/** ${doc} */`);
    }
    const readonly = ctx.readonlyProps ? 'readonly ' : '';
    const optional = required.has(key) ? '' : '?';
    lines.push(`${pad(level + 1, ctx)}${readonly}${propertyKey(key)}${optional}: ${type};`);
  }

  const additional = schema.additionalProperties;
  if (additional === true) {
    lines.push(`${pad(level + 1, ctx)}[key: string]: unknown;`);
  } else if (additional !== undefined && additional !== false) {
    const additionalType = renderType(additional, level + 1, ctx);
    let indexType = additionalType;
    if (propTypes.length) {
      const inline = propTypes.filter((type) => !type.includes('\n'));
      indexType =
        inline.length === propTypes.length ? unionOf([...inline, additionalType]) : 'unknown';
    }
    lines.push(`${pad(level + 1, ctx)}[key: string]: ${indexType};`);
  }

  return { lines, propTypes };
}

function objectType(schema: Record<string, unknown>, level: number, ctx: Ctx): string {
  const { lines } = objectEntries(schema, level, ctx);
  if (!lines.length) return '{}';
  return '{\n' + lines.join('\n') + '\n' + pad(level, ctx) + '}';
}

function arrayType(schema: Record<string, unknown>, level: number, ctx: Ctx): string {
  if (Array.isArray(schema.prefixItems)) {
    const tuple = schema.prefixItems.map((item) => renderType(item, level, ctx));
    return `[${tuple.join(', ')}]`;
  }
  if (schema.items === undefined) return 'unknown[]';
  const inner = Array.isArray(schema.items)
    ? `[${schema.items.map((item) => renderType(item, level, ctx)).join(', ')}]`
    : renderType(schema.items, level, ctx);
  if (inner.includes('\n') || inner.includes(' | ')) return `Array<${inner}>`;
  return `${inner}[]`;
}

function baseType(type: string, schema: Record<string, unknown>, level: number, ctx: Ctx): string {
  switch (type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'array':
      return arrayType(schema, level, ctx);
    case 'object':
      return objectType(schema, level, ctx);
    default:
      return 'unknown';
  }
}

function renderType(schema: unknown, level: number, ctx: Ctx): string {
  if (schema === undefined || schema === true) return 'unknown';
  if (schema === false) return 'never';
  if (!isObj(schema)) return 'unknown';
  if (typeof schema.$ref === 'string') return refName(schema.$ref, ctx);

  const variants: string[] = [];
  if (Array.isArray(schema.anyOf))
    variants.push(...schema.anyOf.map((item) => renderType(item, level, ctx)));
  if (Array.isArray(schema.oneOf))
    variants.push(...schema.oneOf.map((item) => renderType(item, level, ctx)));
  if (Array.isArray(schema.allOf)) {
    const parts = schema.allOf.map((item) => renderType(item, level, ctx));
    variants.push(parts.length ? parts.join(' & ') : 'unknown');
  }
  if (Array.isArray(schema.enum)) variants.push(unionOf(schema.enum.map(literal)));
  if (schema.const !== undefined) variants.push(literal(schema.const));

  const declared = schema.type;
  const types = Array.isArray(declared) ? declared : typeof declared === 'string' ? [declared] : [];
  for (const type of types) variants.push(baseType(type, schema, level, ctx));

  if (!types.length && !variants.length && isObjectLike(schema))
    variants.push(objectType(schema, level, ctx));
  if (schema.nullable === true) variants.push('null');

  return unionOf(variants);
}

function declaration(name: string, schema: unknown, ctx: Ctx): string {
  ctx.stats.declarations += 1;
  const lines: string[] = [];
  const record = isObj(schema) ? schema : {};
  const doc =
    typeof record.description === 'string' ? record.description.trim().replace(/\s+/g, ' ') : '';
  if (ctx.comments && doc) lines.push(`/** ${doc.replace(/\*\//g, '*\\/')} */`);

  if (ctx.style === 'interface' && isObjectLike(record)) {
    const { lines: body } = objectEntries(record, 0, ctx);
    lines.push(`${ctx.exportPrefix}interface ${name} {`);
    lines.push(...body);
    lines.push('}');
  } else {
    lines.push(`${ctx.exportPrefix}type ${name} = ${renderType(schema, 0, ctx)};`);
  }

  return lines.join('\n');
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const indentSize = Number(o.indent ?? 2);
  const style = String(o.style ?? 'interface') === 'type' ? 'type' : 'interface';
  const exportPrefix = o.exportTypes === false ? '' : 'export ';
  const readonlyProps = o.readonlyProps === true;
  const comments = o.comments !== false;
  const rootName = sanitizeTypeName(String(o.rootName ?? 'Root'));

  if (!Number.isInteger(indentSize) || indentSize < 0 || indentSize > 8) {
    throw new ToolError('Indent must be a whole number from 0 to 8.');
  }

  const source = input.text ?? '';
  if (!source.trim()) {
    throw new ToolError(
      'Paste a JSON Schema to convert.',
      'Example: { "type": "object", "properties": { "id": { "type": "integer" } } }',
    );
  }
  if (source.length > MAX_LENGTH) {
    throw new ToolError(
      'Schema is too large.',
      `Keep it under ${MAX_LENGTH.toLocaleString('en-US')} characters.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unexpected token';
    throw new ToolError('Input is not valid JSON.', message);
  }

  if (!isObj(parsed)) {
    throw new ToolError(
      'A JSON Schema must be a JSON object.',
      'Top-level arrays, strings and numbers are not schemas.',
    );
  }

  const ctx: Ctx = {
    unit: ' '.repeat(indentSize),
    style,
    exportPrefix,
    readonlyProps,
    comments,
    defNames: new Map(),
    stats: { declarations: 0, properties: 0, refs: 0 },
  };

  const defs = isObj(parsed.$defs)
    ? parsed.$defs
    : isObj(parsed.definitions)
      ? parsed.definitions
      : {};
  for (const key of Object.keys(defs)) ctx.defNames.set(key, sanitizeTypeName(key));

  const blocks: string[] = [declaration(rootName, parsed, ctx)];
  for (const key of Object.keys(defs)) {
    blocks.push(declaration(ctx.defNames.get(key)!, defs[key], ctx));
  }

  return {
    output: blocks.join('\n\n'),
    render: 'code',
    language: 'typescript',
    stats: {
      declarations: ctx.stats.declarations,
      properties: ctx.stats.properties,
      refs: ctx.stats.refs,
    },
    notes: [
      `Generated ${ctx.stats.declarations} declaration(s) with ${ctx.stats.properties} propert(ies) and ${ctx.stats.refs} resolved reference(s).`,
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
