import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './reverse-text.meta';

/** Split on grapheme-ish code points so most emoji survive. */
function chars(s: string): string[] {
  return Array.from(s);
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const text = input.text;
  if (!text) return { output: '' };
  const by = String(o.by);

  let output: string;
  switch (by) {
    case 'words':
      output = text.split(/(\s+)/).reverse().join('');
      break;
    case 'lines':
      output = text.split('\n').reverse().join('\n');
      break;
    case 'words-in-line':
      output = text
        .split('\n')
        .map((line) => line.split(/(\s+)/).reverse().join(''))
        .join('\n');
      break;
    default:
      output = chars(text).reverse().join('');
  }

  return { output, stats: { characters: chars(text).length } };
}

const tool: TextToolModule = { meta, run };
export default tool;
