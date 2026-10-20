import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './properties-convert.meta';

type J = string | number | boolean | null | J[] | { [k: string]: J };

function buildLogicalLines(text: string): string[] {
  const raw = text.replace(/\r\n/g, '\n');
  const out: string[] = [];
  let cur = '';
  for (const line of raw.split('\n')) {
    if (cur === '' && (/^\s*[#!]/.test(line) || /^\s*$/.test(line))) continue;
    if (cur !== '') {
      // continuation: strip leading whitespace of the next line
      cur += line.replace(/^\s+/, '');
    } else {
      cur = line;
    }
    // count trailing backslashes (escaped backslashes are even counts)
    const m = cur.match(/(\\+)$/);
    if (m && m[1]!.length % 2 === 1) {
      cur = cur.slice(0, cur.length - 1);
      continue;
    }
    out.push(cur);
    cur = '';
  }
  if (cur !== '') out.push(cur);
  return out;
}

function splitKeyValue(line: string): [string, string] {
  // Find first unescaped separator: =, :, or whitespace (Java properties rules).
  let idx = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '\\') {
      i++;
      continue;
    }
    if (ch === '=' || ch === ':' || ch === ' ' || ch === '\t' || ch === '\f') {
      idx = i;
      break;
    }
  }
  if (idx === -1) return [unescapeValue(line), ''];
  const key = line.slice(0, idx);
  let j = idx;
  while (j < line.length && (line[j] === ' ' || line[j] === '\t' || line[j] === '\f')) j++;
  if (j < line.length && (line[j] === '=' || line[j] === ':')) {
    j++;
    while (j < line.length && (line[j] === ' ' || line[j] === '\t' || line[j] === '\f')) j++;
  }
  return [unescapeValue(key), unescapeValue(line.slice(j))];
}

function unescapeValue(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (ch !== '\\' || i === s.length - 1) {
      out += ch;
      continue;
    }
    const next = s[i + 1]!;
    if (next === 'u') {
      const hex = s.slice(i + 2, i + 6);
      if (/^[0-9a-fA-F]{4}$/.test(hex)) {
        out += String.fromCharCode(parseInt(hex, 16));
        i += 5;
      } else {
        out += '\\u';
        i += 1;
      }
      continue;
    }
    const map: Record<string, string> = { n: '\n', r: '\r', t: '\t', f: '\f', '\\': '\\' };
    if (next in map) {
      out += map[next]!;
      i += 1;
    } else {
      out += next;
      i += 1;
    }
  }
  return out;
}

function escapeKey(k: string): string {
  return k
    .replace(/\\/g, '\\\\')
    .replace(/^ /, '\\ ')
    .replace(/[ \t]/g, (c) => (c === ' ' ? '\\ ' : '\\t'))
    .replace(/[=\t]/g, (c) => (c === '=' ? '\\=' : '\\t'));
}

function escapeValue(v: string): string {
  return v
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\f/g, '\\f')
    .replace(/[^ -~]/g, (c) => '\\u' + c.codePointAt(0)!.toString(16).padStart(4, '0'));
}

function parseProperties(text: string): Record<string, J> {
  const out: Record<string, J> = {};
  for (const line of buildLogicalLines(text)) {
    if (/^\s*[#!]/.test(line) || /^\s*$/.test(line)) continue;
    const [k, v] = splitKeyValue(line);
    if (k === '') continue;
    out[k] = v;
  }
  return out;
}

function flattenToProperties(prefix: string, value: J, out: Record<string, string>): void {
  if (value === null || value === undefined) {
    out[prefix === '' ? '' : prefix] = '';
    return;
  }
  const t = typeof value;
  if (t === 'object') {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        out[prefix === '' ? '' : prefix] = '';
        return;
      }
      value.forEach((v, i) =>
        flattenToProperties(prefix === '' ? String(i) : prefix + '.' + i, v, out),
      );
    } else {
      const obj = value as { [k: string]: J };
      const keys = Object.keys(obj);
      if (keys.length === 0) {
        if (prefix !== '') out[prefix] = '';
        return;
      }
      for (const k of keys) {
        flattenToProperties(prefix === '' ? k : prefix + '.' + k, obj[k]!, out);
      }
    }
    return;
  }
  out[prefix] = String(value);
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const mode = o.mode === 'json-to-props' ? 'json-to-props' : 'props-to-json';
  const text = (input.text ?? '').trim();
  if (!text) {
    throw new ToolError(
      mode === 'json-to-props'
        ? 'Enter JSON to serialize to a properties file.'
        : 'Enter a properties file to convert.',
      'Paste content into the text box.',
    );
  }
  if (text.length > 400_000) {
    throw new ToolError('Input is too large.', 'Keep it under 400,000 characters.');
  }

  if (mode === 'json-to-props') {
    let data: J;
    try {
      data = JSON.parse(text) as J;
    } catch {
      throw new ToolError(
        'Invalid JSON.',
        'The input must be a single JSON document in JSON → Properties mode.',
      );
    }
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new ToolError('JSON must be an object.', 'Top-level JSON should be { "key": ... }.');
    }
    const flat: Record<string, string> = {};
    flattenToProperties('', data, flat);
    const lines = Object.entries(flat).map(([k, v]) => escapeKey(k) + '=' + escapeValue(v));
    const output = lines.join('\n');
    return {
      output,
      render: 'code',
      stats: { keys: lines.length },
      notes: [
        `Generated ${lines.length} propert${lines.length === 1 ? 'y' : 'ies'} line${lines.length === 1 ? '' : 's'}.`,
      ],
    };
  }

  const parsed = parseProperties(text);
  const count = Object.keys(parsed).length;
  return {
    output: JSON.stringify(parsed, null, 2),
    render: 'code',
    stats: { keys: count },
    notes: [
      `Parsed ${count} propert${count === 1 ? 'y' : 'ies'}.`,
      'Separators = and : and unicode escapes are decoded.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
