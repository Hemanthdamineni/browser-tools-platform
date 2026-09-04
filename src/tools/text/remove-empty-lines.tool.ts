import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './remove-empty-lines.meta';

const isBlank = (l: string) => l.trim().length === 0;

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };

  const lines = input.text.split('\n');
  const mode = String(o.mode);
  let result: string[];

  if (mode === 'collapse') {
    result = [];
    let prevBlank = false;
    for (const l of lines) {
      const blank = isBlank(l);
      if (blank && prevBlank) continue;
      result.push(l);
      prevBlank = blank;
    }
  } else if (mode === 'trim-trailing') {
    result = lines.slice();
    while (result.length > 0 && isBlank(result[result.length - 1]!)) result.pop();
  } else {
    result = lines.filter((l) => !isBlank(l));
  }

  return {
    output: result.join('\n'),
    stats: { 'lines removed': lines.length - result.length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
