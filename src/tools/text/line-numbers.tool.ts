import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './line-numbers.meta';

const SEPARATORS: Record<string, string> = {
  'dot-space': '. ',
  pipe: ' | ',
  tab: '\t',
  paren: ') ',
  colon: ': ',
};

const isBlank = (l: string) => l.trim().length === 0;

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };

  const lines = input.text.split('\n');
  const parsedStart = Math.floor(Number(o.start));
  const start = Number.isFinite(parsedStart) ? parsedStart : 1;
  const skipBlank = Boolean(o.skipBlank);
  const zeroPad = Boolean(o.zeroPad);
  const sep = SEPARATORS[String(o.separator)] ?? SEPARATORS['dot-space']!;

  const toNumber = skipBlank ? lines.filter((l) => !isBlank(l)).length : lines.length;
  const lastNumber = start + Math.max(0, toNumber - 1);
  const width = Math.max(String(start).length, String(lastNumber).length);

  let n = start;
  const out = lines.map((l) => {
    if (skipBlank && isBlank(l)) return l;
    const label = zeroPad ? String(n).padStart(width, '0') : String(n);
    n += 1;
    return `${label}${sep}${l}`;
  });

  return {
    output: out.join('\n'),
    render: 'code',
    stats: { 'line count': lines.length, numbered: toNumber },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
