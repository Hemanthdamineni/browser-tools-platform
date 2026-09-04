import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './char-frequency.meta';

const LETTER_RE = /\p{L}/u;
const ALNUM_RE = /[\p{L}\p{N}]/u;
const WHITESPACE_RE = /\s/u;

function inScope(ch: string, scope: string): boolean {
  switch (scope) {
    case 'letters':
      return LETTER_RE.test(ch);
    case 'alphanumeric':
      return ALNUM_RE.test(ch);
    case 'no-whitespace':
      return !WHITESPACE_RE.test(ch);
    default:
      return true;
  }
}

/** Human-readable label for a single character. */
function label(ch: string): string {
  if (ch === ' ') return '(space)';
  if (ch === '\t') return '\\t';
  if (ch === '\n') return '\\n';
  if (ch === '\r') return '\\r';
  const cp = ch.codePointAt(0) ?? 0;
  if (cp < 0x20 || cp === 0x7f) {
    return `\\x${cp.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  return ch;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };

  const scope = String(o.scope);
  const caseInsensitive = Boolean(o.caseInsensitive);
  const sortBy = String(o.sortBy);

  const counts = new Map<string, number>();
  let total = 0;

  for (const raw of input.text) {
    const ch = caseInsensitive ? raw.toLowerCase() : raw;
    if (!inScope(ch, scope)) continue;
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
    total += 1;
  }

  const byChar = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  const entries = [...counts.entries()].sort((a, b) =>
    sortBy === 'char' ? byChar(a[0], b[0]) : b[1] - a[1] || byChar(a[0], b[0]),
  );

  const rows = entries.map(([ch, count]) => [
    label(ch),
    String(count),
    `${((count / total) * 100).toFixed(1)}%`,
  ]);

  return {
    output: JSON.stringify({ headers: ['Character', 'Count', '%'], rows }),
    render: 'table',
    stats: { total, distinct: counts.size },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
