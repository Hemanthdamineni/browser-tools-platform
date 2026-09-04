import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './json-format.meta';

function posToLineCol(text: string, pos: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  const stop = Math.min(pos, text.length);
  for (let i = 0; i < stop; i++) {
    if (text[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const byLineCol = /line (\d+) column (\d+)/i.exec(msg);
    const byPos = /position (\d+)/i.exec(msg);
    let hint: string | undefined;
    if (byLineCol) {
      hint = `at line ${byLineCol[1]!}, column ${byLineCol[2]!}`;
    } else if (byPos) {
      const { line, column } = posToLineCol(text, Number(byPos[1]!));
      hint = `at line ${line}, column ${column}`;
    }
    throw new ToolError(msg, hint);
  }
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value !== null && typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src).sort()) {
      out[key] = sortDeep(src[key]);
    }
    return out;
  }
  return value;
}

function indentOf(v: string): string | number {
  if (v === 'tab') return '\t';
  if (v === '4') return 4;
  return 2;
}

function describe(value: unknown): string {
  if (value === null) return 'Top-level value: null';
  if (Array.isArray(value)) {
    const n = value.length;
    return `Top-level value: array; ${n} element${n === 1 ? '' : 's'}`;
  }
  if (typeof value === 'object') {
    const n = Object.keys(value as Record<string, unknown>).length;
    return `Top-level value: object; ${n} top-level key${n === 1 ? '' : 's'}`;
  }
  return `Top-level value: ${typeof value}`;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text.trim()) return { output: '' };

  const value = parseJson(input.text);
  const operation = String(o.operation);
  const indent = indentOf(String(o.indent));

  let output: string;
  const notes: string[] = [];

  if (operation === 'validate') {
    output = 'Valid JSON';
    notes.push(describe(value));
  } else if (operation === 'minify') {
    output = JSON.stringify(value);
  } else if (operation === 'sort-keys') {
    output = JSON.stringify(sortDeep(value), null, indent);
  } else {
    output = JSON.stringify(value, null, indent);
  }

  return {
    output,
    render: 'code',
    language: 'json',
    stats: { 'input chars': input.text.length, 'output chars': output.length },
    notes: notes.length ? notes : undefined,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
