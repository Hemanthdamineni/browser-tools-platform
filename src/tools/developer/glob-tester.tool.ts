import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './glob-tester.meta';

// Convert a glob pattern to a RegExp matching the whole path.
function globToRegExp(pattern: string): RegExp {
  let out = '^';
  let i = 0;
  const p = pattern;
  const push = (s: string): void => {
    out += s;
  };
  const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  while (i < p.length) {
    const ch = p[i]!;
    if (ch === '*') {
      if (p[i + 1] === '*') {
        // '**' — either alone (any chars) or '**/' (zero or more dirs)
        if (p[i + 2] === '/') {
          push('(?:[^/]*/)*');
          i += 3;
          continue;
        }
        push('.*');
        i += 2;
        continue;
      }
      push('[^/]*');
      i += 1;
      continue;
    }
    if (ch === '?') {
      push('[^/]');
      i += 1;
      continue;
    }
    if (ch === '[') {
      // character class until unescaped ']'
      let j = i + 1;
      let cls = '[';
      while (j < p.length && p[j] !== ']') {
        if (p[j] === '\\' && j + 1 < p.length) {
          cls += '\\' + p[j + 1];
          j += 2;
        } else {
          cls += p[j];
          j += 1;
        }
      }
      if (j >= p.length) {
        // unterminated class: treat '[' literally
        push(esc('['));
        i += 1;
        continue;
      }
      cls += ']';
      push(cls);
      i = j + 1;
      continue;
    }
    if (ch === '{') {
      // {a,b} alternation; find matching '}'
      let depth = 0;
      let j = i;
      for (; j < p.length; j++) {
        if (p[j] === '{') depth++;
        else if (p[j] === '}') {
          depth--;
          if (depth === 0) break;
        }
      }
      if (j >= p.length) {
        push(esc('{'));
        i += 1;
        continue;
      }
      const body = p.slice(i + 1, j);
      const alts = body
        .split(',')
        .map((a) => a.trim())
        .map((a) => (a ? globToRegExpToken(a) : ''));
      push('(?:' + alts.join('|') + ')');
      i = j + 1;
      continue;
    }
    push(esc(ch));
    i += 1;
  }
  out += '$';
  return new RegExp(out);
}

// Convert a small glob fragment (used inside brace alternation) to regex source.
function globToRegExpToken(frag: string): string {
  let out = '';
  for (let i = 0; i < frag.length; i++) {
    const ch = frag[i]!;
    if (ch === '*') {
      out += '[^/]*';
    } else if (ch === '?') {
      out += '[^/]';
    } else {
      out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return out;
}

function normalizePath(p: string): string {
  return p.replace(/^\.\//, '').replace(/^\//, '').replace(/\/$/, '');
}

const MAX_PATHS = 50_000;

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const pattern = String(o.pattern ?? '').trim();
  const caseSensitive = o.caseSensitive === true;
  const rawPaths = (input.text ?? '').trim();
  if (!pattern) throw new ToolError('Enter a glob pattern.', 'Example: src/**/*.ts');
  if (!rawPaths) {
    throw new ToolError('Paste one file path per line.', 'Paths are matched against the pattern.');
  }
  const paths = rawPaths
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizePath);
  if (paths.length > MAX_PATHS) {
    throw new ToolError('Too many paths.', `Keep it under ${MAX_PATHS} entries.`);
  }

  let re: RegExp;
  try {
    re = new RegExp(globToRegExp(pattern).source, caseSensitive ? '' : 'i');
  } catch {
    throw new ToolError('Invalid glob pattern.', 'The pattern could not be compiled.');
  }

  let matched = 0;
  const rows: string[][] = [];
  for (const path of paths) {
    const m = re.test(path);
    if (m) matched++;
    rows.push([path, m ? '✓' : '—']);
  }

  return {
    output: JSON.stringify({ headers: ['Path', 'Match'], rows }),
    render: 'table',
    stats: { matched, total: paths.length },
    notes: [
      `${matched} of ${paths.length} path${paths.length === 1 ? '' : 's'} matched "${pattern}".`,
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
