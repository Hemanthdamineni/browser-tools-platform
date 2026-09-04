import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './json-escape.meta';

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };

  const mode = String(o.mode);

  if (mode === 'unescape') {
    let s = input.text.trim();
    const quoted = s.length >= 2 && s.startsWith('"') && s.endsWith('"');
    if (!quoted) s = `"${s}"`;

    let parsed: unknown;
    try {
      parsed = JSON.parse(s);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ToolError('Input is not a valid JSON string literal.', msg);
    }
    if (typeof parsed !== 'string') {
      throw new ToolError(
        'Input is not a JSON string literal.',
        'Expected text optionally wrapped in double quotes.',
      );
    }
    return {
      output: parsed,
      stats: { 'input chars': input.text.length, 'output chars': parsed.length },
    };
  }

  const output = JSON.stringify(input.text);
  return {
    output,
    render: 'code',
    language: 'json',
    stats: { 'input chars': input.text.length, 'output chars': output.length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
