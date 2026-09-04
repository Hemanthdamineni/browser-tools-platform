import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './json-to-typescript.meta';

interface Prop {
  key: string;
  type: string;
  optional: boolean;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pascal(s: string): string {
  const parts = s.split(/[^A-Za-z0-9]+/).filter(Boolean);
  let out = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  if (!out) out = 'Key';
  if (/^[0-9]/.test(out)) out = `_${out}`;
  return out;
}

function safeKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function wrapArray(parts: string[]): string {
  const uniq = [...new Set(parts)];
  if (uniq.length === 0) return 'unknown[]';
  if (uniq.length === 1) return `${uniq[0]}[]`;
  return `(${uniq.join(' | ')})[]`;
}

interface Ctx {
  mergeAll: boolean;
  preferInterfaces: boolean;
  readonlyProps: boolean;
  decls: Map<string, string>;
  order: string[];
}

function register(ctx: Ctx, name: string, props: Prop[]): void {
  if (ctx.decls.has(name)) return;
  let body: string;
  if (props.length === 0) {
    body = ctx.preferInterfaces ? `interface ${name} {}` : `type ${name} = {};`;
  } else {
    const lines = props.map((p) => {
      const ro = ctx.readonlyProps ? 'readonly ' : '';
      const opt = p.optional ? '?' : '';
      return `  ${ro}${safeKey(p.key)}${opt}: ${p.type};`;
    });
    body = ctx.preferInterfaces
      ? `interface ${name} {\n${lines.join('\n')}\n}`
      : `type ${name} = {\n${lines.join('\n')}\n};`;
  }
  ctx.decls.set(name, body);
  ctx.order.push(name);
}

function objectType(ctx: Ctx, obj: Record<string, unknown>, name: string): string {
  const props: Prop[] = Object.keys(obj).map((k) => ({
    key: k,
    type: collect(ctx, obj[k], name + pascal(k)),
    optional: false,
  }));
  register(ctx, name, props);
  return name;
}

function mergeObjects(ctx: Ctx, objs: Record<string, unknown>[], name: string): string {
  const keyOrder: string[] = [];
  const seen = new Set<string>();
  for (const obj of objs) {
    for (const k of Object.keys(obj)) {
      if (!seen.has(k)) {
        seen.add(k);
        keyOrder.push(k);
      }
    }
  }
  const props: Prop[] = keyOrder.map((k) => {
    const present = objs.filter((o) => Object.prototype.hasOwnProperty.call(o, k));
    return {
      key: k,
      type: unionOfValues(
        ctx,
        present.map((o) => o[k]),
        name + pascal(k),
      ),
      optional: present.length < objs.length,
    };
  });
  register(ctx, name, props);
  return name;
}

function unionOfValues(ctx: Ctx, vals: unknown[], name: string): string {
  if (vals.length === 0) return 'unknown';
  if (vals.every(isPlainObject)) {
    return mergeObjects(ctx, vals as Record<string, unknown>[], name);
  }
  if (vals.every((v) => Array.isArray(v))) {
    const combined = ([] as unknown[]).concat(...(vals as unknown[][]));
    return arrayType(ctx, combined, name);
  }
  const parts = [...new Set(vals.map((v) => collect(ctx, v, name)))];
  return parts.join(' | ');
}

function arrayType(ctx: Ctx, arr: unknown[], name: string): string {
  if (arr.length === 0) return 'unknown[]';
  const elemName = `${name}Item`;
  if (!ctx.mergeAll) {
    return wrapArray([collect(ctx, arr[0]!, elemName)]);
  }
  if (arr.every(isPlainObject)) {
    return `${mergeObjects(ctx, arr as Record<string, unknown>[], elemName)}[]`;
  }
  if (arr.every((v) => Array.isArray(v))) {
    const combined = ([] as unknown[]).concat(...(arr as unknown[][]));
    return `${arrayType(ctx, combined, elemName)}[]`;
  }
  return wrapArray(arr.map((v) => collect(ctx, v, elemName)));
}

function collect(ctx: Ctx, value: unknown, name: string): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return arrayType(ctx, value, name);
  switch (typeof value) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'object':
      return objectType(ctx, value as Record<string, unknown>, name);
    default:
      return 'unknown';
  }
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

  const rootName = pascal(String(o.rootName || 'Root'));
  const ctx: Ctx = {
    mergeAll: Boolean(o.arrayMergeSampleAll),
    preferInterfaces: Boolean(o.preferInterfaces),
    readonlyProps: Boolean(o.readonlyProps),
    decls: new Map(),
    order: [],
  };

  const rootExpr = collect(ctx, value, rootName);
  const blocks = [...ctx.order].reverse().map((n) => ctx.decls.get(n)!);

  let output: string;
  if (isPlainObject(value)) {
    output = blocks.join('\n\n');
  } else {
    output = [`type ${rootName} = ${rootExpr};`, ...blocks].join('\n\n');
  }

  return {
    output,
    render: 'code',
    language: 'typescript',
    filename: 'types.ts',
    stats: { 'named types': blocks.length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
