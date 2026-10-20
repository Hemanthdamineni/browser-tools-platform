import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './json-to-graphql.meta';

const MAX_LEN = 1_000_000;

interface SDLType {
  name: string;
  fields: Array<{ key: string; type: string; sample: unknown }>;
}

function pascal(value: string): string {
  const clean = value
    .replace(/[^a-zA-Z0-9_$]/g, ' ')
    .replace(/(?:^|[\s_]+)([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase());
  const out = clean.replace(/\s+/g, '') || 'Value';
  return out[0]!.toUpperCase() + out.slice(1);
}

function uniqueName(base: string, taken: Set<string>): string {
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  let n = 2;
  while (taken.has(base + n)) n += 1;
  taken.add(base + n);
  return base + n;
}

function singularize(word: string): string {
  if (word.length > 1 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function infer(
  value: unknown,
  hint: string | null,
  types: SDLType[],
  taken: Set<string>,
  notes: Set<string>,
): string {
  if (value === null) return 'String';
  switch (typeof value) {
    case 'string':
      return 'String';
    case 'boolean':
      return 'Boolean';
    case 'number':
      return Number.isInteger(value) ? 'Int' : 'Float';
    case 'object': {
      if (Array.isArray(value)) {
        if (value.length === 0) return '[String]';
        const distinct: string[] = [];
        for (const item of value) {
          const t = infer(item, hint === null ? null : singularize(hint), types, taken, notes);
          if (!distinct.includes(t)) distinct.push(t);
        }
        if (distinct.length === 1) return '[' + distinct[0]! + ']';
        notes.add('Mixed-typed arrays were mapped to [String] — define a union type if needed.');
        return '[String]';
      }
      const keys = Object.keys(value);
      const nameBase = hint === null ? 'Value' : pascal(hint);
      const existing = types.find((t) => t.name === nameBase);
      if (existing) return existing.name;
      const name = uniqueName(nameBase, taken);
      const fields: SDLType['fields'] = [];
      for (const k of keys) {
        const v = (value as Record<string, unknown>)[k];
        const fieldType = infer(v, pascal(k), types, taken, notes);
        fields.push({ key: k, type: fieldType, sample: v });
      }
      types.push({ name, fields });
      return name;
    }
    default:
      return 'String';
  }
}

function fieldKey(key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? key : JSON.stringify(key);
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const rootName = String(o.rootName ?? 'Root').trim() || 'Root';
  const strict = o.strictNull === true;
  const indent = String(o.indent ?? '2') === '4' ? 4 : 2;

  const source = input.text ?? '';
  if (!source.trim()) throw new ToolError('Paste a JSON object to convert to GraphQL types.');
  if (source.length > MAX_LEN)
    throw new ToolError('Input is too large.', 'Keep it under 1,000,000 characters.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    throw new ToolError('That is not valid JSON.', 'Fix the document and try again.');
  }

  const types: SDLType[] = [];
  const taken = new Set<string>();
  const notes = new Set<string>();
  const pad = ' '.repeat(indent);

  const isObjectRoot =
    parsed !== null &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    Object.keys(parsed as Record<string, unknown>).length > 0;
  const rootNameTaken = uniqueName(rootName, taken);
  if (isObjectRoot) {
    const root = parsed as Record<string, unknown>;
    const fields: SDLType['fields'] = [];
    for (const k of Object.keys(root)) {
      const v = root[k];
      fields.push({ key: k, type: infer(v, pascal(k), types, taken, notes), sample: v });
    }
    types.unshift({ name: rootNameTaken, fields });
  } else {
    types.unshift({
      name: rootNameTaken,
      fields: [{ key: 'value', type: infer(parsed, null, types, taken, notes), sample: parsed }],
    });
  }

  const body = types
    .map((t) => {
      const lines = t.fields.map((f) => {
        let type = f.type;
        if (strict && f.sample !== null && f.sample !== undefined) type += '!';
        return pad + fieldKey(f.key) + ': ' + type;
      });
      return 'type ' + t.name + ' {\n' + lines.join('\n') + '\n}';
    })
    .join('\n\n');

  const fieldCount = types.reduce((n, t) => n + t.fields.length, 0);
  const noteLines = [...notes];
  return {
    output: body + '\n',
    render: 'code',
    language: 'graphql',
    stats: { types: types.length, fields: fieldCount },
    notes: noteLines.length
      ? noteLines
      : ['Scalars are inferred from the sample — confirm them for your API.'],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
