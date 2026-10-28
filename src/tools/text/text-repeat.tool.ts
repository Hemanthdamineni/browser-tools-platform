import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './text-repeat.meta';


const NAMED_SEPARATORS: Record<string, string> = {
  newline: '\n',
  space: ' ',
  comma: ',',
  none: '',
};

function resolveSeparator(separator: string, custom: string): string {
  if (separator === 'custom') return custom;
  return NAMED_SEPARATORS[separator] ?? '\n';
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };

  const n = Math.floor(Number(o.count));
  if (!Number.isFinite(n) || n < 1) {
    throw new ToolError('Number of copies must be at least 1.');
  }
  const count = n;
  const separator = resolveSeparator(String(o.separator), String(o.custom ?? ''));


  const output = new Array(count).fill(input.text).join(separator);

  return {
    output,
    stats: {
      copies: count,
      'total length': output.length,
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
