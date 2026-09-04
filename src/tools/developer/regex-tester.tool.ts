import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './regex-tester.meta';

function buildRegex(pattern: string, flags: string): RegExp {
  try {
    return new RegExp(pattern, flags);
  } catch (e) {
    throw new ToolError((e as Error).message, 'Check the pattern and flags.');
  }
}

function withGlobal(re: RegExp): RegExp {
  return re.flags.includes('g') ? re : new RegExp(re.source, `${re.flags}g`);
}

function groupsJson(m: RegExpMatchArray): string {
  const groups: Record<string, string | null> = {};
  for (let i = 1; i < m.length; i++) groups[String(i)] = m[i] ?? null;
  if (m.groups) {
    for (const [k, v] of Object.entries(m.groups)) groups[k] = v ?? null;
  }
  return JSON.stringify(groups);
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);

  if (!input.text) return { output: '' };

  const pattern = String(o.pattern ?? '');
  if (!pattern) {
    throw new ToolError(
      'A regular expression pattern is required.',
      'Enter a pattern in the options.',
    );
  }

  const flags = String(o.flags ?? 'gm');
  if (!/^[gimsuy]*$/.test(flags)) {
    throw new ToolError(`Invalid regex flags: "${flags}".`, 'Allowed flags: g i m s u y.');
  }

  const re = buildRegex(pattern, flags);
  const mode = String(o.mode ?? 'matches');

  if (mode === 'matches') {
    const gre = withGlobal(re);
    const rows: string[][] = [];
    for (const m of input.text.matchAll(gre)) {
      rows.push([String(rows.length + 1), m[0], groupsJson(m), String(m.index ?? 0)]);
    }
    return {
      output: JSON.stringify({ headers: ['#', 'Match', 'Groups', 'Index'], rows }),
      render: 'table',
      stats: { matches: rows.length, flags },
    };
  }

  if (mode === 'replace') {
    const replacement = String(o.replacement ?? '$&');
    return {
      output: input.text.replace(re, replacement),
      stats: { flags },
    };
  }

  if (mode === 'split') {
    const pieces = input.text.split(re);
    return {
      output: pieces.join('\n'),
      stats: { pieces: pieces.length },
    };
  }

  // highlight
  const gre = withGlobal(re);
  let count = 0;
  const output = input.text.replace(gre, (m: string) => {
    if (m === '') return m;
    count += 1;
    return `<<${m}>>`;
  });
  return { output, stats: { matches: count, flags } };
}

const tool: TextToolModule = { meta, run };
export default tool;
