import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './querystring.meta';

type QSValue = string | string[];

function decodeComponent(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    throw new ToolError(
      `Could not URL-decode "${raw}".`,
      'Check for stray % characters that are not part of a valid %XX escape.',
    );
  }
}

function addValue(
  result: Record<string, QSValue>,
  key: string,
  value: string,
  forceArray: boolean,
): void {
  if (Object.prototype.hasOwnProperty.call(result, key)) {
    const cur = result[key]!;
    if (Array.isArray(cur)) cur.push(value);
    else result[key] = [cur, value];
  } else {
    result[key] = forceArray ? [value] : value;
  }
}

function parseQuery(text: string, arrayFormat: string): Record<string, QSValue> {
  let s = text.trim();
  if (s.startsWith('?') || s.startsWith('#')) s = s.slice(1);
  const result: Record<string, QSValue> = {};
  if (!s) return result;

  for (const part of s.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const rawKey = eq === -1 ? part : part.slice(0, eq);
    const rawVal = eq === -1 ? '' : part.slice(eq + 1);
    let key = decodeComponent(rawKey);
    const val = decodeComponent(rawVal);

    let forceArray = false;
    if (arrayFormat === 'brackets' && key.endsWith('[]')) {
      key = key.slice(0, -2);
      forceArray = true;
    }

    if (arrayFormat === 'comma' && val.includes(',')) {
      for (const piece of val.split(',')) addValue(result, key, piece, true);
    } else {
      addValue(result, key, val, forceArray);
    }
  }
  return result;
}

function sortObject(obj: Record<string, QSValue>): Record<string, QSValue> {
  const out: Record<string, QSValue> = {};
  for (const k of Object.keys(obj).sort()) out[k] = obj[k]!;
  return out;
}

function scalarStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function buildQuery(obj: Record<string, unknown>, arrayFormat: string, sortKeys: boolean): string {
  const keys = sortKeys ? Object.keys(obj).sort() : Object.keys(obj);
  const parts: string[] = [];
  for (const key of keys) {
    const val = obj[key];
    if (Array.isArray(val)) {
      if (arrayFormat === 'comma') {
        parts.push(
          `${encodeURIComponent(key)}=${val.map((x) => encodeURIComponent(scalarStr(x))).join(',')}`,
        );
      } else if (arrayFormat === 'brackets') {
        for (const x of val)
          parts.push(`${encodeURIComponent(`${key}[]`)}=${encodeURIComponent(scalarStr(x))}`);
      } else {
        for (const x of val)
          parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(scalarStr(x))}`);
      }
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(scalarStr(val))}`);
    }
  }
  return parts.join('&');
}

function countArrays(obj: Record<string, QSValue>): number {
  return Object.values(obj).filter((v) => Array.isArray(v)).length;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text.trim()) return { output: '' };

  const arrayFormat = String(o.arrayFormat);
  const sortKeys = Boolean(o.sortKeys);

  if (o.mode === 'build') {
    let data: unknown;
    try {
      data = JSON.parse(input.text);
    } catch (e) {
      throw new ToolError('Invalid JSON input.', (e as Error).message);
    }
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new ToolError(
        'Expected a JSON object.',
        'The top level must be an object of key/value pairs.',
      );
    }
    const output = buildQuery(data as Record<string, unknown>, arrayFormat, sortKeys);
    return {
      output,
      render: 'text',
      filename: 'query.txt',
      stats: { pairs: output ? output.split('&').length : 0 },
    };
  }

  let parsed = parseQuery(input.text, arrayFormat);
  if (sortKeys) parsed = sortObject(parsed);
  const output = JSON.stringify(parsed, null, 2);
  return {
    output,
    render: 'code',
    language: 'json',
    filename: 'query.json',
    stats: { keys: Object.keys(parsed).length, arrays: countArrays(parsed) },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
