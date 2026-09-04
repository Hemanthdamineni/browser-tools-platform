import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './sql-format.meta';

/** Private-use sentinel wrapped around masked-literal indices. */
const SENT = '';

/** Keywords rewritten to uppercase (whole-word, case-insensitive). */
const KEYWORDS = [
  'SELECT',
  'DISTINCT',
  'FROM',
  'WHERE',
  'AS',
  'ON',
  'AND',
  'OR',
  'NOT',
  'IN',
  'IS',
  'NULL',
  'LIKE',
  'BETWEEN',
  'EXISTS',
  'GROUP',
  'BY',
  'ORDER',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'UNION',
  'ALL',
  'JOIN',
  'INNER',
  'LEFT',
  'RIGHT',
  'FULL',
  'OUTER',
  'CROSS',
  'USING',
  'INSERT',
  'INTO',
  'VALUES',
  'UPDATE',
  'SET',
  'DELETE',
  'ASC',
  'DESC',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
  'COUNT',
  'SUM',
  'AVG',
  'MIN',
  'MAX',
  'COALESCE',
  'CAST',
];

const KEYWORD_RE = new RegExp(`\\b(?:${KEYWORDS.join('|')})\\b`, 'gi');

const MAJOR_RE =
  /\s*\b(DELETE\s+FROM|INSERT\s+INTO|SELECT|FROM|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|OFFSET|UNION(?:\s+ALL)?|VALUES|UPDATE|SET|(?:(?:LEFT|RIGHT|INNER|FULL|CROSS|OUTER)\s+)*JOIN)\b/gi;

const SUB_RE = /\s*\b(ON|AND|OR)\b/gi;

/** Split on `sep` only at paren depth 0. */
function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = '';
  for (const ch of s) {
    if (ch === '(') {
      depth += 1;
      buf += ch;
    } else if (ch === ')') {
      depth = Math.max(0, depth - 1);
      buf += ch;
    } else if (ch === sep && depth === 0) {
      out.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim() !== '' || out.length > 0) out.push(buf);
  return out;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };

  const uppercase = Boolean(o.uppercaseKeywords);
  const indentUnit = ' '.repeat(o.indent === '4' ? 4 : 2);

  // 1. Mask string literals and comments so they are never reformatted.
  const literals: string[] = [];
  const masked = input.text.replace(
    /('(?:[^']|'')*')|(--[^\n]*)|(\/\*[\s\S]*?\*\/)|("(?:[^"]|"")*")/g,
    (m) => {
      literals.push(m);
      return `${SENT}${literals.length - 1}${SENT}`;
    },
  );

  if (/['"]/.test(masked)) {
    throw new ToolError(
      'Unterminated string or quoted identifier.',
      'Add the missing closing quote, or escape a literal quote by doubling it.',
    );
  }
  if (masked.includes('/*')) {
    throw new ToolError('Unterminated block comment.', 'Close it with */.');
  }

  // 2. Normalise whitespace.
  let sql = masked.replace(/\s+/g, ' ').trim();
  if (!sql) return { output: '' };

  // 3. Keyword casing.
  if (uppercase) sql = sql.replace(KEYWORD_RE, (m) => m.toUpperCase());

  // 4. Line break before every major clause, then before ON / AND / OR.
  sql = sql.replace(MAJOR_RE, (_m, kw: string) => `\n${kw.replace(/\s+/g, ' ')}`);
  sql = sql.replace(SUB_RE, (_m, kw: string) => `\n${kw}`);

  // 5. Per-line indentation and SELECT-list expansion.
  const lines: string[] = [];
  for (const raw of sql.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    if (/^select\b/i.test(line)) {
      const kw = line.slice(0, 6);
      const rest = line.slice(6).replace(/^\s+/, '');
      const cols = splitTopLevel(rest, ',');
      if (cols.length > 1) {
        lines.push(kw);
        cols.forEach((col, i) => {
          lines.push(indentUnit + col.trim() + (i < cols.length - 1 ? ',' : ''));
        });
      } else {
        lines.push(line);
      }
      continue;
    }

    if (/^(?:on|and|or)\b/i.test(line)) {
      lines.push(indentUnit + line);
      continue;
    }

    lines.push(line);
  }

  // 6. Restore masked literals.
  const restore = (s: string) =>
    s.replace(
      new RegExp(`${SENT}(\\d+)${SENT}`, 'g'),
      (_m, i: string) => literals[Number(i)] ?? '',
    );

  const output = restore(lines.join('\n'));

  return {
    output,
    render: 'code',
    language: 'sql',
    stats: {
      lines: output ? output.split('\n').length : 0,
      'literals kept': literals.length,
      keywords: uppercase ? 'uppercase' : 'unchanged',
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
