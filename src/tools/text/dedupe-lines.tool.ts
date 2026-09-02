import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './dedupe-lines.meta';

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };

  const lines = input.text.split('\n');
  const norm = (l: string) => {
    let k = o.trim ? l.trim() : l;
    if (o.ignoreCase) k = k.toLowerCase();
    return k;
  };
  const isBlank = (l: string) => l.trim().length === 0;

  const counts = new Map<string, number>();
  for (const l of lines) counts.set(norm(l), (counts.get(norm(l)) ?? 0) + 1);

  const keep = String(o.keep);
  let result: string[];

  if (keep === 'only-duplicates' || keep === 'only-unique') {
    const wantRepeat = keep === 'only-duplicates';
    const emitted = new Set<string>();
    result = lines.filter((l) => {
      if (o.keepBlank && isBlank(l)) return true;
      const k = norm(l);
      if ((counts.get(k) ?? 0) > 1 !== wantRepeat) return false;
      if (emitted.has(k)) return false;
      emitted.add(k);
      return true;
    });
  } else if (keep === 'last') {
    const lastIndex = new Map<string, number>();
    lines.forEach((l, i) => {
      if (!(o.keepBlank && isBlank(l))) lastIndex.set(norm(l), i);
    });
    result = lines.filter((l, i) => (o.keepBlank && isBlank(l)) || lastIndex.get(norm(l)) === i);
  } else {
    const seen = new Set<string>();
    result = lines.filter((l) => {
      if (o.keepBlank && isBlank(l)) return true;
      const k = norm(l);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  return {
    output: result.join('\n'),
    stats: { kept: result.length, removed: lines.length - result.length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
