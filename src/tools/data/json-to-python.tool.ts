import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './json-to-python.meta';

const MAX_LENGTH = 1_000_000;

type Ctx = {
  style: 'dataclass' | 'typeddict';
  unit: string;
  useOptional: boolean;
  snakeCase: boolean;
  pipeUnion: boolean;
  classes: Array<{ name: string; emit: (ctx: Ctx) => string[] }>;
  seen: Map<string, boolean>;
  stats: { classes: number; fields: number; lists: number };
};

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const isObj = (value: unknown): value is Record<string, Json> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function toPascal(key: string): string {
  const parts = key
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  if (!parts.length) return 'Value';
  const name = parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
  return /^[A-Za-z_]/.test(name) ? name : 'Value' + name;
}

function toSnake(key: string): string {
  const cleaned = key
    .replace(
      /([a-z0-9])([A-Z])/g,
      (_all, lower: string, upper: string) => `${lower}_${upper.toLowerCase()}`,
    )
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!cleaned) return 'field';
  const result = cleaned.replace(/_+/g, '_');
  return /^[A-Za-z_]/.test(result) ? result : `f_${result}`;
}

function literalDefault(value: Json): string | null {
  if (value === null) return 'None';
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value);
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  return null;
}

function typeFor(value: Json, hint: string, ctx: Ctx): string {
  if (value === null) return 'None';
  if (typeof value === 'string') return 'str';
  if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float';
  if (typeof value === 'boolean') return 'bool';
  if (Array.isArray(value)) {
    ctx.stats.lists += 1;
    if (!value.length) return 'list[Any]';
    const element = value[0]!;
    return `list[${typeFor(element, hint, ctx)}]`;
  }
  if (isObj(value)) {
    const name = toPascal(hint);
    if (!ctx.seen.has(name)) {
      ctx.seen.set(name, true);
      ctx.classes.push({ name, emit: (inner) => emitClass(value, name, inner) });
    } else {
      return name;
    }
    return name;
  }
  return 'Any';
}

function emitClass(obj: Record<string, Json>, name: string, ctx: Ctx): string[] {
  const pad = ctx.unit;
  const lines: string[] = [];
  const entries = Object.keys(obj);
  ctx.stats.classes += 1;
  for (const key of entries) {
    const value = obj[key]!;
    const fieldName = ctx.snakeCase ? toSnake(key) : key;
    ctx.stats.fields += 1;
    const type = typeFor(value, key, ctx);

    if (value === null) {
      if (ctx.style === 'dataclass') lines.push(`${pad}${fieldName}: Optional[Any] = None`);
      else lines.push(`${pad}${fieldName}: Optional[Any]`);
      continue;
    }
    if (ctx.style === 'dataclass' && Array.isArray(value)) {
      lines.push(`${pad}${fieldName}: ${type} = field(default_factory=list)`);
      continue;
    }
    if (ctx.style === 'dataclass' && ctx.useOptional) {
      const union = ctx.pipeUnion ? `${type} | None` : `Optional[${type}]`;
      if (!/^Any$/.test(type) && literalDefault(value) !== null) {
        lines.push(`${pad}${fieldName}: ${union} = ${literalDefault(value)}`);
      } else {
        lines.push(`${pad}${fieldName}: ${union} = None`);
      }
      continue;
    }
    lines.push(`${pad}${fieldName}: ${type}`);
  }
  const header =
    ctx.style === 'typeddict' ? `class ${name}(TypedDict):` : `@dataclass\nclass ${name}:`;
  return [header, ...lines];
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const style = String(o.style ?? 'dataclass') === 'typeddict' ? 'typeddict' : 'dataclass';
  const rootName = toPascal(String(o.rootName ?? 'Root'));
  const useOptional = o.useOptional !== false;
  const snakeCase = o.snakeCase !== false;
  const pipeUnion = String(o.unionSyntax ?? 'optional') === 'pipe';
  const indent = Number(o.indent ?? 4);
  if (![2, 3, 4, 6, 8].includes(indent)) {
    throw new ToolError('Indent must be one of 2, 3, 4, 6 or 8 spaces.');
  }

  const source = input.text ?? '';
  if (!source.trim()) {
    throw new ToolError('Paste a JSON sample to convert.', 'Example: {"name": "Ada", "age": 37}');
  }
  if (source.length > MAX_LENGTH) {
    throw new ToolError(
      'JSON is too large.',
      `Keep it under ${MAX_LENGTH.toLocaleString('en-US')} characters.`,
    );
  }

  let parsed: Json | null;
  try {
    parsed = JSON.parse(source) as Json;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unexpected token';
    throw new ToolError('Input is not valid JSON.', message);
  }
  if (parsed === null || parsed === undefined) {
    throw new ToolError('JSON is empty.', 'Paste an object or array with at least one value.');
  }

  const ctx: Ctx = {
    style,
    unit: ' '.repeat(indent),
    useOptional,
    snakeCase,
    pipeUnion,
    classes: [],
    seen: new Map(),
    stats: { classes: 0, fields: 0, lists: 0 },
  };

  const body: string[] = [];
  const rootPayload = isObj(parsed)
    ? parsed
    : Array.isArray(parsed) && isObj(parsed[0])
      ? parsed[0]
      : null;
  if (rootPayload) {
    typeFor(rootPayload, rootName, ctx); // register the root model under the chosen name
  } else {
    body.push(
      `${rootName} = ${Array.isArray(parsed) ? 'list[Any]' : typeFor(parsed, rootName, ctx)}`,
    );
  }

  for (const entry of ctx.classes) body.push(...entry.emit(ctx));

  const header: string[] = [];
  if (style === 'dataclass') {
    header.push('from __future__ import annotations');
    header.push('from dataclasses import dataclass, field');
    if (pipeUnion === false || useOptional) header.push('from typing import Any, Optional');
    else header.push('from typing import Any');
  } else {
    header.push('from typing import Any, TypedDict');
  }

  return {
    output: [...header, '', ...body].join('\n'),
    render: 'code',
    language: 'python',
    stats: {
      classes: ctx.stats.classes,
      fields: ctx.stats.fields,
      lists: ctx.stats.lists,
    },
    notes: [
      `Inferred ${ctx.stats.classes} model(s) with ${ctx.stats.fields} field(s) from the sample (Python 3.9+${pipeUnion ? ', 3.10+ for str | None' : ''}).`,
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
