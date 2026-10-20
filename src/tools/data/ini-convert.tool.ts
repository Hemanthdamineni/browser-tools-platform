import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './ini-convert.meta';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function inferValue(s: string): Json {
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d*\.?\d+([eE][+-]?\d+)?$/.test(s)) return parseFloat(s);
  return s;
}

function parseIni(input: string): Record<string, Json> {
  const result: Record<string, Json> = {};
  let section: string | null = null;
  for (const raw of input.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;
    const sec = line.match(/^\[(.+)\]$/);
    if (sec) {
      section = sec[1]!.trim();
      if (!(section in result)) result[section] = {};
      continue;
    }
    const eq = line.indexOf('=');
    let key: string;
    let rawVal: string;
    let hasEq: boolean;
    if (eq === -1) {
      key = line.trim();
      rawVal = '';
      hasEq = false;
    } else {
      key = line.slice(0, eq).trim();
      rawVal = line.slice(eq + 1).trim();
      hasEq = true;
    }
    if (!key) continue;
    const value: Json = hasEq ? inferValue(rawVal) : true;
    if (section === null) {
      result[key] = value;
    } else {
      (result[section] as Record<string, Json>)[key] = value;
    }
  }
  return result;
}

function prim(v: Json): string {
  if (v === null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function jsonToIni(root: { [key: string]: Json }): string {
  const out: string[] = [];
  const writeLevel = (scope: string, obj: { [key: string]: Json }) => {
    for (const [k, v] of Object.entries(obj)) {
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        const header = scope ? `${scope}.${k}` : k;
        out.push(`[${header}]`);
        writeLevel(header, v as { [key: string]: Json });
      } else if (Array.isArray(v)) {
        v.forEach((item, i) => out.push(`${k}.${i} = ${prim(item)}`));
      } else {
        out.push(`${k} = ${prim(v)}`);
      }
    }
  };
  writeLevel('', root);
  return out.join('\n') + '\n';
}

function flatKeyCount(v: Json): number {
  if (v === null || typeof v !== 'object') return 0;
  if (Array.isArray(v)) return v.reduce<number>((n, x) => n + flatKeyCount(x), 0);
  let n = 0;
  for (const key of Object.keys(v)) {
    n += 1;
    n += flatKeyCount(v[key] as Json);
  }
  return n;
}

function countSections(v: Json): number {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return 0;
  let n = 0;
  for (const key of Object.keys(v)) {
    const child = v[key];
    if (child !== null && typeof child === 'object' && !Array.isArray(child)) {
      n += 1;
      n += countSections(child);
    }
  }
  return n;
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const mode = String(o.mode ?? 'ini-to-json');
  const text = (input.text ?? '').trim();

  if (!text) {
    throw new ToolError(
      'Paste an INI config file or a JSON object.',
      'Choose the direction with the mode option.',
    );
  }

  if (mode === 'json-to-ini') {
    let parsed: Json;
    try {
      parsed = JSON.parse(text) as Json;
    } catch (e) {
      throw new ToolError(
        `Invalid JSON: ${(e as Error).message}`,
        'Check quotes, commas and brackets.',
      );
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new ToolError('The JSON root must be an object.', 'Sections come from object members.');
    }
    const output = jsonToIni(parsed as { [key: string]: Json });
    return {
      output,
      render: 'code',
      stats: { keys: flatKeyCount(parsed), sections: countSections(parsed) },
      notes: ['JSON serialized to INI; sections use [name] and arrays use repeated dotted keys.'],
    };
  }

  const parsed = parseIni(text);
  if (Object.keys(parsed).length === 0) {
    throw new ToolError(
      'No INI content was found.',
      'Use key = value lines and [section] headers; ; and # start comments.',
    );
  }
  const stats = { keys: flatKeyCount(parsed), sections: countSections(parsed) };
  return {
    output: JSON.stringify(parsed, null, 2) + '\n',
    render: 'code',
    stats,
    notes: ['INI parsed; booleans, integers and floats were inferred from values.'],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
