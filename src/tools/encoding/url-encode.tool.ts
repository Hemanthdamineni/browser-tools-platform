import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './url-encode.meta';

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };

  if (o.mode === 'decode') {
    let text = input.text;
    if (o.plusSpace) text = text.replace(/\+/g, ' ');
    try {
      const out = o.scope === 'full' ? decodeURI(text) : decodeURIComponent(text);
      return { output: out, stats: { 'output chars': out.length } };
    } catch {
      throw new ToolError(
        'Malformed percent-encoding.',
        'Check for a lone % or an incomplete %XX sequence.',
      );
    }
  }

  const out = o.scope === 'full' ? encodeURI(input.text) : encodeURIComponent(input.text);
  return { output: out, render: 'code', stats: { 'output chars': out.length } };
}

const tool: TextToolModule = { meta, run };
export default tool;
