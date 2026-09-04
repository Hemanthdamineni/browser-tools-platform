import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './backslash-escape.meta';

const NAMED: Record<string, string> = {
  '\n': '\\n',
  '\t': '\\t',
  '\r': '\\r',
  '\f': '\\f',
  '\v': '\\v',
};

/** Real characters → backslash escape sequences. */
function escape(s: string): string {
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (ch === '\\') {
      out += '\\\\';
      continue;
    }
    if (ch in NAMED) {
      out += NAMED[ch]!;
      continue;
    }
    if (cp === 0) {
      out += '\\0';
      continue;
    }
    if (/\p{C}/u.test(ch)) {
      if (cp <= 0xff) out += '\\x' + cp.toString(16).padStart(2, '0');
      else if (cp <= 0xffff) out += '\\u' + cp.toString(16).padStart(4, '0');
      else out += '\\u{' + cp.toString(16) + '}';
      continue;
    }
    out += ch;
  }
  return out;
}

interface UnescapeResult {
  out: string;
  unknown: string[];
}

/** Backslash escape sequences → real characters. */
function unescape(s: string): UnescapeResult {
  let out = '';
  const unknown = new Set<string>();
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c !== '\\') {
      out += c;
      continue;
    }
    const n = s[i + 1];
    if (n === undefined) {
      out += '\\';
      break;
    }
    if (n === 'n') {
      out += '\n';
      i += 1;
    } else if (n === 't') {
      out += '\t';
      i += 1;
    } else if (n === 'r') {
      out += '\r';
      i += 1;
    } else if (n === 'f') {
      out += '\f';
      i += 1;
    } else if (n === 'v') {
      out += '\v';
      i += 1;
    } else if (n === '0') {
      out += '\0';
      i += 1;
    } else if (n === '\\') {
      out += '\\';
      i += 1;
    } else if (n === 'x') {
      const m = /^[0-9a-fA-F]{2}/.exec(s.slice(i + 2));
      if (m) {
        out += String.fromCharCode(parseInt(m[0], 16));
        i += 1 + m[0].length;
      } else {
        unknown.add('\\x');
        out += 'x';
        i += 1;
      }
    } else if (n === 'u') {
      if (s[i + 2] === '{') {
        const end = s.indexOf('}', i + 3);
        if (end === -1) {
          throw new ToolError(
            'Unterminated \\u{…} escape.',
            'Add the closing brace, e.g. \\u{1F600}.',
          );
        }
        const body = s.slice(i + 3, end);
        if (!/^[0-9a-fA-F]+$/.test(body)) {
          throw new ToolError(`Invalid \\u{…} escape: "${body}" is not hexadecimal.`);
        }
        const value = parseInt(body, 16);
        if (value > 0x10ffff) {
          throw new ToolError(`Code point U+${body.toUpperCase()} is above the U+10FFFF maximum.`);
        }
        out += String.fromCodePoint(value);
        i = end;
      } else {
        const m = /^[0-9a-fA-F]{4}/.exec(s.slice(i + 2));
        if (m) {
          out += String.fromCharCode(parseInt(m[0], 16));
          i += 1 + m[0].length;
        } else {
          unknown.add('\\u');
          out += 'u';
          i += 1;
        }
      }
    } else {
      unknown.add('\\' + n);
      out += n;
      i += 1;
    }
  }
  return { out, unknown: [...unknown] };
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };

  const mode = String(o.mode);
  if (mode === 'unescape') {
    const { out, unknown } = unescape(input.text);
    return {
      output: out,
      render: 'code',
      language: 'text',
      notes:
        unknown.length > 0
          ? [
              `Unknown escape${unknown.length > 1 ? 's' : ''} kept without the backslash: ${unknown.join(', ')}.`,
            ]
          : undefined,
      stats: { mode, 'input chars': input.text.length, 'output chars': out.length },
    };
  }

  const out = escape(input.text);
  return {
    output: out,
    render: 'code',
    language: 'text',
    stats: { mode, 'input chars': input.text.length, 'output chars': out.length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
