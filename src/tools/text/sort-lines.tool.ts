import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './sort-lines.meta';

/** Deterministic PRNG so shuffle is stable within a run (seeded from content). */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };

  let lines = input.text.split('\n');
  if (o.trim) lines = lines.map((l) => l.trim());
  if (o.removeBlank) lines = lines.filter((l) => l.trim().length > 0);
  const before = lines.length;
  if (o.unique) lines = [...new Set(lines)];

  const method = String(o.method);
  const ci = !o.caseSensitive;
  const key = (l: string) => (ci ? l.toLowerCase() : l);

  if (method === 'shuffle') {
    let seed = 0;
    for (const ch of input.text) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    lines = seededShuffle(lines, seed);
  } else {
    const collator = new Intl.Collator(undefined, {
      numeric: method === 'natural',
      sensitivity: ci ? 'base' : 'variant',
    });
    lines.sort((a, b) => {
      if (method === 'length') return a.length - b.length || collator.compare(key(a), key(b));
      if (method === 'numeric') {
        const na = parseFloat(a);
        const nb = parseFloat(b);
        const va = Number.isNaN(na) ? Infinity : na;
        const vb = Number.isNaN(nb) ? Infinity : nb;
        return va - vb || collator.compare(key(a), key(b));
      }
      return collator.compare(key(a), key(b));
    });
    if (o.direction === 'desc') lines.reverse();
  }

  return {
    output: lines.join('\n'),
    stats: { lines: lines.length, ...(o.unique ? { removed: before - lines.length } : {}) },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
