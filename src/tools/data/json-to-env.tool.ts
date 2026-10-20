import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './json-to-env.meta';

const MAX_LEN = 1_000_000;

function escapeEnvValue(text: string): string {
  return String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
}

function envKey(parts: string[], uppercase: boolean, separator: string): string {
  const joined = parts.join(separator);
  return uppercase ? joined.toUpperCase() : joined;
}

function formatValue(value: unknown, quoteStrings: boolean): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    if (!quoteStrings) return value;
    if (/[\s#"'"\\\r\n]/.test(value)) return '"' + escapeEnvValue(value) + '"';
    return value;
  }
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  return JSON.stringify(value); // arrays and objects
}

function flatten(
  node: unknown,
  path: string[],
  lines: Array<[string, string]>,
  uppercase: boolean,
  separator: string,
  quoteStrings: boolean,
  depth: number,
): void {
  if (depth > 128) throw new ToolError('Too deeply nested.');
  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    lines.push([envKey(path, uppercase, separator), formatValue(node, quoteStrings)]);
    return;
  }
  const entries = Object.entries(node as Record<string, unknown>);
  if (!entries.length) {
    lines.push([envKey(path, uppercase, separator), '']);
    return;
  }
  for (const [k, v] of entries) flatten(v, [...path, k], lines, uppercase, separator, quoteStrings, depth + 1);
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const uppercase = o.uppercase !== false;
  const quoteStrings = o.quoteStrings !== false;
  const separator = String(o.separator ?? '__');

  const source = input.text ?? '';
  if (!source.trim()) throw new ToolError('Paste a JSON configuration to convert to env lines.');
  if (source.length > MAX_LEN) throw new ToolError('Input is too large.', 'Keep it under 1,000,000 characters.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    throw new ToolError('That is not valid JSON.', 'Fix the document and try again.');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ToolError('Expected a JSON object.', 'Example: { "server": { "port": 8080 } }');
  }

  const lines: Array<[string, string]> = [];
  flatten(parsed, [], lines, uppercase, separator, quoteStrings, 0);

  const output = lines.map(([k, v]) => k + '=' + v).join('\n') + '\n';
  return {
    output,
    render: 'text',
    language: 'text',
    stats: { variables: lines.length },
    notes: [
      'Nested keys flattened with "' + separator + '" separators.',
      uppercase ? 'Variable names are uppercase.' : 'Variable names keep their original case.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
