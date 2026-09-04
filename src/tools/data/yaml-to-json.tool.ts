import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { parse } from 'yaml';
import { meta } from './yaml-to-json.meta';

function sortReplacer(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src).sort()) out[k] = src[k];
    return out;
  }
  return value;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text.trim()) return { output: '' };

  let data: unknown;
  try {
    data = parse(input.text);
  } catch (e) {
    throw new ToolError('Invalid YAML input.', (e as Error).message);
  }
  if (data === undefined) return { output: '' };

  const indent: string | number = o.indent === 'tab' ? '\t' : o.indent === '4' ? 4 : 2;
  const output = JSON.stringify(data, o.sortKeys ? sortReplacer : undefined, indent);

  return {
    output,
    render: 'code',
    language: 'json',
    filename: 'data.json',
    stats: { 'output lines': output.split('\n').length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
