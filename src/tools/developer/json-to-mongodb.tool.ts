import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './json-to-mongodb.meta';

const MAX_LEN = 2_000_000;

function documentsOf(parsed: unknown): Record<string, unknown>[] {
  const list = Array.isArray(parsed) ? parsed : [parsed];
  const docs: Record<string, unknown>[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new ToolError(
        'Every document must be a JSON object.',
        'Item ' +
          (i + 1) +
          ' is ' +
          (item === null ? 'null' : Array.isArray(item) ? 'an array' : typeof item) +
          '.',
      );
    }
    docs.push(item as Record<string, unknown>);
  }
  return docs;
}

/** Serialize a value as a JavaScript/JSON literal, preserving exact types. */
function literal(value: unknown, indent: number, width: number): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new ToolError('Non-finite number in input.', 'Use null instead of NaN/Infinity.');
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const pad = ' '.repeat(indent);
  const inner = ' '.repeat(indent + width);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (width === 0) return '[' + value.map((v) => literal(v, 0, 0)).join(',') + ']';
    const parts = value.map((v) => inner + literal(v, indent + width, width));
    return '[\n' + parts.join(',\n') + '\n' + pad + ']';
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    if (width === 0) {
      return (
        '{' + entries.map(([k, v]) => JSON.stringify(k) + ':' + literal(v, 0, 0)).join(',') + '}'
      );
    }
    const parts = entries.map(
      ([k, v]) => inner + JSON.stringify(k) + ': ' + literal(v, indent + width, width),
    );
    return '{\n' + parts.join(',\n') + '\n' + pad + '}';
  }
  throw new ToolError('Unsupported value in input.');
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const collection = String(o.collection ?? '').trim();
  const format = String(o.format ?? 'pretty');
  const wrapped = o.wrapped !== false;
  const indentSpaces = Math.max(0, Math.min(8, Number(o.indentSpaces ?? 2)));

  const raw = String(input.text ?? '').trim();
  if (!raw) throw new ToolError('Paste JSON documents to convert.');
  if (raw.length > MAX_LEN)
    throw new ToolError('Input is too large.', 'Keep it under ' + MAX_LEN + ' characters.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new ToolError('Invalid JSON: ' + (e as Error).message);
  }

  const docs = documentsOf(parsed);
  if (docs.length === 0) throw new ToolError('No documents found in the JSON array.');

  if (wrapped && !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(collection)) {
    throw new ToolError(
      'Collection name must be a valid MongoDB identifier.',
      'Letters, digits and underscores; no dashes or spaces.',
    );
  }

  const width = format === 'compact' ? 0 : indentSpaces;
  const docText = docs
    .map((d) => literal(d, width === 0 ? 0 : 2, width))
    .join(width === 0 ? ',' : ',\n');

  let output: string;
  if (wrapped) {
    const arrayBody =
      width === 0 ? '[' + docText + ']' : '[\n  ' + docText.split('\n').join('\n  ') + '\n]';
    output = 'db.' + collection + '.insertMany(' + arrayBody + ');\n';
  } else {
    output = docText + '\n';
  }

  return {
    output,
    render: 'text',
    language: 'javascript',
    stats: { documents: docs.length, fields: docs.reduce((n, d) => n + Object.keys(d).length, 0) },
    notes: [
      docs.length + ' document(s) for collection "' + (collection || '(none)') + '".',
      wrapped ? 'Run in mongosh or a MongoDB shell.' : 'Raw documents — no script wrapper.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
