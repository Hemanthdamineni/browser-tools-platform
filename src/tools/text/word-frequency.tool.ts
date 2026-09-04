import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './word-frequency.meta';

/** ~40 common English function words. */
const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'if',
  'of',
  'at',
  'by',
  'for',
  'with',
  'about',
  'into',
  'to',
  'from',
  'in',
  'on',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'i',
  'you',
  'he',
  'she',
  'we',
  'they',
  'as',
  'not',
  'no',
]);

const WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };

  const caseInsensitive = Boolean(o.caseInsensitive);
  const minLength = clampInt(o.minLength, 1, 20, 1);
  const top = clampInt(o.top, 0, 500, 25);
  const ignoreCommon = Boolean(o.ignoreCommon);

  const matched = input.text.match(WORD_RE) ?? [];
  const counts = new Map<string, number>();
  let total = 0;

  for (const raw of matched) {
    const word = caseInsensitive ? raw.toLowerCase() : raw;
    if ([...word].length < minLength) continue;
    if (ignoreCommon && STOP_WORDS.has(word.toLowerCase())) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
    total += 1;
  }

  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const shown = top > 0 ? entries.slice(0, top) : entries;

  const rows = shown.map(([word, count]) => [
    word,
    String(count),
    `${((count / total) * 100).toFixed(1)}%`,
  ]);

  return {
    output: JSON.stringify({ headers: ['Word', 'Count', '%'], rows }),
    render: 'table',
    stats: {
      'total words': total,
      'unique words': counts.size,
      shown: rows.length,
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
