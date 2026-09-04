import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './indent-text.meta';

const isBlank = (line: string) => line.trim() === '';

function indent(text: string, prefix: string, skipBlank: boolean): string {
  return text
    .split('\n')
    .map((line) => (skipBlank && isBlank(line) ? line : prefix + line))
    .join('\n');
}

function dedent(text: string, unitChar: string, maxUnits: number, skipBlank: boolean): string {
  return text
    .split('\n')
    .map((line) => {
      if (skipBlank && isBlank(line)) return line;
      let i = 0;
      while (i < maxUnits && line[i] === unitChar) i++;
      return line.slice(i);
    })
    .join('\n');
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };

  const count = Math.floor(Number(o.count));
  if (!Number.isFinite(count) || count < 1 || count > 16) {
    throw new ToolError('Units per level must be between 1 and 16.');
  }

  const unitChar = String(o.unit) === 'tabs' ? '\t' : ' ';
  const skipBlank = Boolean(o.skipBlank);
  const mode = String(o.mode);

  const output =
    mode === 'dedent'
      ? dedent(input.text, unitChar, count, skipBlank)
      : indent(input.text, unitChar.repeat(count), skipBlank);

  return {
    output,
    stats: {
      lines: output.split('\n').length,
      unit: unitChar === '\t' ? 'tab' : 'space',
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
