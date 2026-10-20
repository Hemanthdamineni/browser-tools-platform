import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './regex-explainer.meta';

const MAX_LENGTH = 50_000;

const ESCAPE_MEANINGS: Record<string, string> = {
  d: 'any digit (0–9)',
  D: 'any non-digit character',
  w: 'any word character (letter, digit or underscore)',
  W: 'any non-word character',
  s: 'any whitespace character (space, tab, line break)',
  S: 'any non-whitespace character',
  b: 'a word boundary',
  B: 'a position that is not a word boundary',
  n: 'newline',
  r: 'carriage return',
  t: 'horizontal tab',
  f: 'form feed',
  v: 'vertical tab',
  '0': 'the NUL character',
  A: 'start of the whole input',
  Z: 'end of input, before a trailing line terminator',
  z: 'very end of the input',
};

const FLAG_MEANINGS: Record<string, string> = {
  g: 'global — find every match, not just the first',
  i: 'case-insensitive — letters match ignoring case',
  m: 'multiline — ^ and $ also match at line boundaries',
  s: 'dotAll — . also matches line terminators',
  u: 'unicode — matches code points and enables \\u{…} and \\p{…}',
  y: 'sticky — matches only at the lastIndex position',
  d: 'indices — match start/end indices are provided',
  v: 'unicode sets — enables set operations inside character classes',
};

type Tok = { text: string; meaning: string };

/** Explain one escape sequence starting at pattern[i] (after the backslash). */
function explainEscape(
  pattern: string,
  i: number,
): { text: string; meaning: string; used: number } {
  const c = pattern[i] ?? '';
  if (c === 'x') {
    const hex = pattern.slice(i + 1, i + 3);
    const code = Number.parseInt(hex, 16);
    return {
      text: '\\x' + hex,
      meaning: Number.isNaN(code)
        ? 'hex escape — a character by its codepoint (unknown hex)'
        : `hex escape — the character U+${hex.toUpperCase()} ('${String.fromCodePoint(code)}')`,
      used: 3,
    };
  }
  if (c === 'u') {
    if (pattern[i + 1] === '{') {
      const end = pattern.indexOf('}', i + 2);
      const inner = pattern.slice(i + 2, end === -1 ? i + 2 : end);
      return {
        text: '\\u{' + inner + '}',
        meaning: /^[0-9a-fA-F]+$/.test(inner)
          ? `unicode code point escape — U+${inner.toUpperCase()}`
          : 'unicode code point escape (requires the u flag)',
        used: end === -1 ? i + 2 : end + 1 - i,
      };
    }
    const hex = pattern.slice(i + 1, i + 5);
    return {
      text: '\\u' + hex,
      meaning: `unicode escape for U+${hex.toUpperCase()}`,
      used: 5,
    };
  }
  if (c === 'p' || c === 'P') {
    const end = pattern.indexOf('}', i + 2);
    const inner = pattern.slice(i + 2, end === -1 ? i + 2 : end);
    const neg = c === 'P';
    return {
      text: '\\' + c + '{' + inner + '}',
      meaning: `Unicode property — any character with the ${inner || '?'} property${neg ? ' (negated)' : ''}`,
      used: end === -1 ? i + 2 : end + 1 - i,
    };
  }
  if (c === 'k') {
    const m = /^<([^>]+)>/.exec(pattern.slice(i + 1));
    return {
      text: '\\k<' + (m ? m[1] : '') + '>',
      meaning: `backreference to the group named "${m ? m[1] : ''}"`,
      used: 1 + (m ? m[0].length : 1),
    };
  }
  if (/^[1-9]$/.test(c)) {
    return {
      text: '\\' + c,
      meaning: `backreference — matches the text captured by group ${c}`,
      used: 2,
    };
  }
  const known = ESCAPE_MEANINGS[c];
  if (known) return { text: '\\' + c, meaning: known, used: 2 };
  return {
    text: '\\' + c,
    meaning: `escaped literal ${c} — matches the ${c} character itself`,
    used: 2,
  };
}

/** Read a character class starting at pattern[i] ('['). */
function readClass(
  pattern: string,
  i: number,
  unicode: boolean,
): { text: string; meaning: string; used: number } {
  let j = i + 1;
  let negated = false;
  if (pattern[j] === '^') {
    negated = true;
    j += 1;
  }
  let body = '';
  let closed = false;
  while (j < pattern.length) {
    const c = pattern[j]!;
    if (c === ']') {
      closed = true;
      j += 1;
      break;
    }
    if (c === '\\') {
      body += pattern.slice(j, j + 2);
      j += 2;
      continue;
    }
    body += c;
    j += 1;
  }
  if (!closed) {
    return {
      text: pattern.slice(i, j),
      meaning: 'character class that is never closed (the ] is missing)',
      used: j - i,
    };
  }
  const readable = body.length > 40 ? body.slice(0, 37) + '…' : body;
  void unicode;
  const verb = negated ? 'any character except the ones listed' : 'any character that matches';
  return {
    text: '[' + (negated ? '^' : '') + readable + ']',
    meaning: `${verb} in the class: ${readable || '(empty)'}`,
    used: j - i,
  };
}

function readQuantifier(
  pattern: string,
  i: number,
): { text: string; meaning: string; used: number } | null {
  const c = pattern[i] ?? '';
  if (c === '*') {
    let suffix = pattern[i + 1] === '?' ? '?' : pattern[i + 1] === '+' ? '+' : '';
    let mode = '';
    if (suffix === '?') mode = '; non-greedy (matches as few as possible)';
    if (suffix === '+') mode = '; possessive (no backtracking)';
    return { text: '*' + suffix, meaning: `zero or more times${mode}`, used: 1 + suffix.length };
  }
  if (c === '+') return { text: '+', meaning: 'one or more times (greedy)', used: 1 };
  if (c === '?') return { text: '?', meaning: 'zero or one time (optional)', used: 1 };
  if (c === '{') {
    const m = /^\{(\d+)(,(\d*)?)?\}/.exec(pattern.slice(i));
    if (m) {
      const min = m[1]!;
      const comma = m[2];
      const max = m[3];
      let qMeaning: string;
      if (comma === undefined) qMeaning = `exactly ${min} time(s)`;
      else if (max === undefined || max === '') qMeaning = `${min} or more times`;
      else qMeaning = `between ${min} and ${max} times`;
      const suffix = pattern[i + m[0].length] === '?' ? '?' : '';
      if (suffix === '?') qMeaning += '; non-greedy';
      return { text: m[0] + suffix, meaning: qMeaning, used: m[0].length + suffix.length };
    }
  }
  return null;
}

function explainGroupsAndFlags(
  pattern: string,
  flags: string,
): { tokens: Tok[]; captures: number } {
  const tokens: Tok[] = [];
  let captures = 0;

  const add = (text: string, meaning: string): void => {
    tokens.push({ text, meaning });
  };

  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i]!;

    if (c === '\\') {
      const esc = explainEscape(pattern, i + 1);
      add(esc.text, esc.meaning);
      i += esc.used - 1;
      continue;
    }

    if (c === '[') {
      const cls = readClass(pattern, i, flags.includes('v'));
      add(cls.text, cls.meaning);
      i += cls.used - 1;
      continue;
    }

    if (c === '(') {
      let prefix: string;
      let meaning: string;
      if (pattern.startsWith('(?:', i)) {
        prefix = '(?:';
        meaning = 'non-capturing group — groups tokens without capturing';
      } else if (pattern.startsWith('(?=', i)) {
        prefix = '(?=';
        meaning = 'lookahead — matches only if what follows matches; captures nothing';
      } else if (pattern.startsWith('(?!', i)) {
        prefix = '(?!';
        meaning = 'negative lookahead — matches only if what follows does NOT match';
      } else if (pattern.startsWith('(?<=', i)) {
        prefix = '(?<=';
        meaning = 'lookbehind — matches only if what precedes matches';
      } else if (pattern.startsWith('(?<!', i)) {
        prefix = '(?<!';
        meaning = 'negative lookbehind — matches only if what precedes does NOT match';
      } else if (pattern.startsWith('(?<', i)) {
        const nameMatch = /^<(?:[A-Za-z_][A-Za-z0-9_]*|[^>]+)>/.exec(pattern.slice(i + 2));
        const name = nameMatch ? nameMatch[0].slice(1, -1) : '';
        prefix = nameMatch ? `(?<${name}>` : '(?<';
        captures += 1;
        meaning = `named capturing group "${name}" — captures the matched text`;
      } else if (pattern.startsWith('(?', i) && /^[ims]+:/.test(pattern.slice(i + 2, i + 6))) {
        prefix = pattern.slice(i, i + 6);
        meaning = 'inline mode flags — toggles i, m, or s for the tokens that follow';
      } else {
        captures += 1;
        prefix = '(';
        meaning = `capturing group ${captures} — captures the matched text`;
      }
      add(prefix, meaning);
      i += prefix.length - 1;
      continue;
    }

    if (c === ')') {
      add(')', 'closes the enclosing group (the tokens between the parentheses)');
      continue;
    }

    const quant = readQuantifier(pattern, i);
    if (quant) {
      if (tokens.length) {
        const last = tokens[tokens.length - 1]!;
        last.text += ' ' + quant.text;
        last.meaning += '; repeated ' + quant.meaning + '';
      } else {
        add(quant.text, quant.meaning + ' (nothing precedes it — likely a mistake)');
      }
      i += quant.used - 1;
      continue;
    }

    if (c === '^') {
      add(
        '^',
        flags.includes('m') ? 'start of the input or of a line (multiline)' : 'start of the input',
      );
      continue;
    }
    if (c === '$') {
      add(
        '$',
        flags.includes('m') ? 'end of the input or of a line (multiline)' : 'end of the input',
      );
      continue;
    }
    if (c === '.') {
      add(
        '.',
        flags.includes('s')
          ? 'any character, including line terminators (dotAll)'
          : 'any character except line terminators',
      );
      continue;
    }
    if (c === '|') {
      add('|', 'alternation — match the left side OR the right side');
      continue;
    }

    // A literal character.
    add(JSON.stringify(c), `literal ${c} — matches the ${c} character`);
  }

  return { tokens, captures };
}

function decodeFlags(flags: string): string[] {
  const lines: string[] = [];
  for (const flag of flags) {
    const meaning = FLAG_MEANINGS[flag];
    if (meaning) lines.push(`${flag} — ${meaning}`);
    else lines.push(`${flag} — unknown flag for JavaScript regexes`);
  }
  return lines;
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const flags = String(o.flags ?? '').replace(/[^a-z]/gi, '');
  const pattern = input.text ?? '';

  if (!pattern.trim()) {
    throw new ToolError(
      'Paste a regular expression to explain.',
      'Example: ^[a-z0-9]+@[a-z]+\\.[a-z]{2,}$',
    );
  }
  if (pattern.length > MAX_LENGTH) {
    throw new ToolError(
      'The expression is too large.',
      `Keep it under ${MAX_LENGTH.toLocaleString('en-US')} characters.`,
    );
  }

  const { tokens, captures } = explainGroupsAndFlags(pattern, flags);
  const flagLines = decodeFlags(flags);

  const headers = ['#', 'Token', 'What it does'];
  const rows: string[][] = tokens.map((token, index) => [
    String(index + 1),
    token.text.length > 60 ? token.text.slice(0, 57) + '…' : token.text,
    token.meaning,
  ]);

  const summary: string[] = [];
  summary.push(`Explained ${tokens.length} token(s); ${captures} capturing group(s).`);
  if (flagLines.length) summary.push('Flags: ' + flagLines.join('; '));

  return {
    output: JSON.stringify({ headers, rows }),
    render: 'table',
    stats: { tokens: tokens.length, captures },
    notes: summary,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
