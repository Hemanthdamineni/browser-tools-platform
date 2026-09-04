import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './json-to-csv.meta';

const DELIMS: Record<string, string> = {
  comma: ',',
  semicolon: ';',
  tab: '\t',
  pipe: '|',
};

function flattenInto(
  obj: Record<string, unknown>,
  prefix: string,
  out: Record<string, unknown>,
  flatten: boolean,
): void {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (flatten && v !== null && typeof v === 'object' && !Array.isArray(v)) {
      flattenInto(v as Record<string, unknown>, key, out, flatten);
    } else {
      out[key] = v;
    }
  }
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text.trim()) return { output: '' };

  let data: unknown;
  try {
    data = JSON.parse(input.text);
  } catch (e) {
    throw new ToolError('Invalid JSON input.', (e as Error).message);
  }
  if (!Array.isArray(data)) {
    throw new ToolError(
      'Input must be a JSON array.',
      'Provide an array of objects or an array of arrays.',
    );
  }
  if (data.length === 0) return { output: '' };

  const delim = DELIMS[String(o.delimiter)] ?? ',';
  const flatten = Boolean(o.flatten);
  const writeHeader = Boolean(o.header);

  const esc = (val: unknown): string => {
    let s: string;
    if (val === null || val === undefined) s = '';
    else if (typeof val === 'object') s = JSON.stringify(val);
    else s = String(val);
    if (s.includes(delim) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      s = `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines: string[] = [];

  if (Array.isArray(data[0])) {
    for (const row of data) {
      if (!Array.isArray(row)) {
        throw new ToolError(
          'Every row must be an array.',
          'The first row is an array, so all rows must be arrays.',
        );
      }
      lines.push((row as unknown[]).map(esc).join(delim));
    }
    return {
      output: lines.join('\n'),
      render: 'code',
      language: 'csv',
      filename: 'data.csv',
      stats: { rows: data.length },
    };
  }

  const keys: string[] = [];
  const seen = new Set<string>();
  const flatRows: Record<string, unknown>[] = [];
  for (const row of data) {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) {
      throw new ToolError('Every row must be a JSON object.', 'Found a row that is not an object.');
    }
    const flat: Record<string, unknown> = {};
    flattenInto(row as Record<string, unknown>, '', flat, flatten);
    flatRows.push(flat);
    for (const k of Object.keys(flat)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }

  if (writeHeader) lines.push(keys.map(esc).join(delim));
  for (const flat of flatRows) {
    lines.push(
      keys
        .map((k) => esc(Object.prototype.hasOwnProperty.call(flat, k) ? flat[k] : ''))
        .join(delim),
    );
  }

  return {
    output: lines.join('\n'),
    render: 'code',
    language: 'csv',
    filename: 'data.csv',
    stats: { rows: data.length, columns: keys.length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
