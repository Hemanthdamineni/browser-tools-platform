import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './editorconfig.meta';

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const lines: string[] = ['root = true', '', '[*]'];
  const style = String(o.indentStyle);
  const size = Number(o.indentSize) || 2;
  if (style === 'tab') {
    lines.push('indent_style = tab');
  } else {
    lines.push('indent_style = space', `indent_size = ${size}`);
  }
  lines.push(`end_of_line = ${String(o.endOfLine)}`);
  lines.push(`charset = ${String(o.charset)}`);
  lines.push(`trim_trailing_whitespace = ${o.trimTrailingWhitespace ? 'true' : 'false'}`);
  lines.push(`insert_final_newline = ${o.insertFinalNewline ? 'true' : 'false'}`);
  const max = Number(o.maxLineLength) || 0;
  if (max > 0) lines.push(`max_line_length = ${max}`);
  lines.push('', '[*.md]', 'trim_trailing_whitespace = false');

  return { output: lines.join('\n') + '\n', render: 'code', language: 'ini' };
}

const tool: TextToolModule = { meta, run };
export default tool;
