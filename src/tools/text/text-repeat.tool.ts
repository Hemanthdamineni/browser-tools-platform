import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './text-repeat.meta';

const MAX_OUTPUT = 5_000_000;

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
  const count = Math.min(100000, n);

  const separator = resolveSeparator(String(o.separator), String(o.custom ?? ''));

  const predicted = input.text.length * count + separator.length * (count - 1);
  if (predicted > MAX_OUTPUT) {
    throw new ToolError(
      'Output too large — reduce the count.',
      `That would produce about ${predicted.toLocaleString()} characters; the limit is ${MAX_OUTPUT.toLocaleString()}.`,
    );
  }

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
