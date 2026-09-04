import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './string-escape.meta';

/* -------------------------------------------------------------------------- */
/*  Escape helpers                                                            */
/* -------------------------------------------------------------------------- */

function hex2(cp: number): string {
  return cp.toString(16).padStart(2, '0');
}

function hex4(cp: number): string {
  return cp.toString(16).padStart(4, '0');
}

function jsEscape(s: string): string {
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (ch === '\\') out += '\\\\';
    else if (ch === '"') out += '\\"';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (ch === '\f') out += '\\f';
    else if (ch === '\v') out += '\\v';
    else if (ch === '\b') out += '\\b';
    else if (cp === 0) out += '\\0';
    else if (cp === 0x2028) out += '\\u2028';
    else if (cp === 0x2029) out += '\\u2029';
    else if (cp < 0x20 || cp === 0x7f) out += '\\x' + hex2(cp);
    else out += ch;
  }
  return out;
}

const C_NAMED: Record<string, string> = {
  '\x07': '\\a',
  '\b': '\\b',
  '\f': '\\f',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  '\v': '\\v',
};

function cEscape(s: string): string {
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (ch === '\\') out += '\\\\';
    else if (ch === '"') out += '\\"';
    else if (ch in C_NAMED) out += C_NAMED[ch]!;
    else if (cp === 0) out += '\\0';
    else if (cp < 0x20 || cp === 0x7f) out += '\\' + cp.toString(8).padStart(3, '0');
    else if (cp > 0xffff) out += '\\U' + cp.toString(16).padStart(8, '0');
    else if (cp > 0x7f) out += '\\u' + hex4(cp);
    else out += ch;
  }
  return out;
}

function javaEscape(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const cu = s.charCodeAt(i);
    const ch = s[i]!;
    if (ch === '\\') out += '\\\\';
    else if (ch === '"') out += '\\"';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (ch === '\f') out += '\\f';
    else if (ch === '\b') out += '\\b';
    else if (cu < 0x20 || cu > 0x7e) out += '\\u' + hex4(cu);
    else out += ch;
  }
  return out;
}

function pyEscape(s: string): string {
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (ch === '\\') out += '\\\\';
    else if (ch === '"') out += '\\"';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (ch === '\f') out += '\\f';
    else if (ch === '\v') out += '\\v';
    else if (ch === '\b') out += '\\b';
    else if (cp === 0) out += '\\x00';
    else if (cp < 0x20 || (cp >= 0x7f && cp <= 0xff)) out += '\\x' + hex2(cp);
    else if (cp > 0xffff) out += '\\U' + cp.toString(16).padStart(8, '0');
    else if (cp > 0x7e) out += '\\u' + hex4(cp);
    else out += ch;
  }
  return out;
}

function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

function csvEscape(s: string): string {
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/* -------------------------------------------------------------------------- */
/*  Unescape helpers                                                          */
/* -------------------------------------------------------------------------- */

function stripQuotes(s: string, quotes: string): string {
  if (s.length >= 2) {
    const first = s[0]!;
    if (quotes.includes(first) && s[s.length - 1] === first) return s.slice(1, -1);
  }
  return s;
}

/** Interpret common backslash escapes (JS / C / Java / Python family). */
function backslashUnescape(s: string): string {
  let out = '';
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
    } else if (n === 'r') {
      out += '\r';
      i += 1;
    } else if (n === 't') {
      out += '\t';
      i += 1;
    } else if (n === 'f') {
      out += '\f';
      i += 1;
    } else if (n === 'v') {
      out += '\v';
      i += 1;
    } else if (n === 'b') {
      out += '\b';
      i += 1;
    } else if (n === 'a') {
      out += '\x07';
      i += 1;
    } else if (n === '\\') {
      out += '\\';
      i += 1;
    } else if (n === '"') {
      out += '"';
      i += 1;
    } else if (n === "'") {
      out += "'";
      i += 1;
    } else if (n === '/') {
      out += '/';
      i += 1;
    } else if (n === 'x') {
      const m = /^[0-9a-fA-F]{2}/.exec(s.slice(i + 2));
      if (m) {
        out += String.fromCharCode(parseInt(m[0], 16));
        i += 1 + m[0].length;
      } else {
        out += 'x';
        i += 1;
      }
    } else if (n === 'u') {
      if (s[i + 2] === '{') {
        const end = s.indexOf('}', i + 3);
        const body = end > -1 ? s.slice(i + 3, end) : '';
        if (end > -1 && /^[0-9a-fA-F]+$/.test(body) && parseInt(body, 16) <= 0x10ffff) {
          out += String.fromCodePoint(parseInt(body, 16));
          i = end;
        } else {
          out += 'u';
          i += 1;
        }
      } else {
        const m = /^[0-9a-fA-F]{4}/.exec(s.slice(i + 2));
        if (m) {
          out += String.fromCharCode(parseInt(m[0], 16));
          i += 1 + m[0].length;
        } else {
          out += 'u';
          i += 1;
        }
      }
    } else if (n === 'U') {
      const m = /^[0-9a-fA-F]{8}/.exec(s.slice(i + 2));
      if (m && parseInt(m[0], 16) <= 0x10ffff) {
        out += String.fromCodePoint(parseInt(m[0], 16));
        i += 1 + m[0].length;
      } else {
        out += 'U';
        i += 1;
      }
    } else if (n >= '0' && n <= '7') {
      const m = /^[0-7]{1,3}/.exec(s.slice(i + 1))!;
      out += String.fromCharCode(parseInt(m[0], 8) & 0xff);
      i += m[0].length;
    } else {
      out += n;
      i += 1;
    }
  }
  return out;
}

function jsonUnescape(s: string): string {
  const t = s.trim();
  const wrapped = t.startsWith('"') ? t : '"' + t + '"';
  let value: unknown;
  try {
    value = JSON.parse(wrapped);
  } catch {
    throw new ToolError(
      'Not a valid JSON string.',
      'Expected text like line\\nbreak using only valid JSON escapes.',
    );
  }
  if (typeof value !== 'string') throw new ToolError('That JSON value is not a string.');
  return value;
}

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  copy: '\u00a9',
  reg: '\u00ae',
  trade: '\u2122',
  hellip: '\u2026',
  mdash: '\u2014',
  ndash: '\u2013',
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '\u201c',
  rdquo: '\u201d',
  laquo: '\u00ab',
  raquo: '\u00bb',
  deg: '\u00b0',
  plusmn: '\u00b1',
  times: '\u00d7',
  divide: '\u00f7',
  euro: '\u20ac',
  pound: '\u00a3',
  cent: '\u00a2',
  yen: '\u00a5',
  sect: '\u00a7',
  middot: '\u00b7',
  bull: '\u2022',
};

const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeEntities(s: string, named: Record<string, string>): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body: string) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const cp = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (Number.isFinite(cp) && cp >= 0 && cp <= 0x10ffff) {
        try {
          return String.fromCodePoint(cp);
        } catch {
          return whole;
        }
      }
      return whole;
    }
    return Object.prototype.hasOwnProperty.call(named, body) ? named[body]! : whole;
  });
}

function shellUnescape(s: string): string {
  let t = s.trim();
  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'")) t = t.slice(1, -1);
  return t.replace(/'\\''/g, "'").replace(/'"'"'/g, "'").replace(/\\x27/gi, "'");
}

function sqlUnescape(s: string): string {
  let t = s;
  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'")) t = t.slice(1, -1);
  return t.replace(/''/g, "'");
}

function csvUnescape(s: string): string {
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/""/g, '"');
  }
  return s;
}

function urlUnescape(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    throw new ToolError(
      'Invalid percent-encoding.',
      'Look for a stray % or an incomplete %XX pair.',
    );
  }
}

/* -------------------------------------------------------------------------- */

const LANGUAGE: Record<string, string> = {
  javascript: 'javascript',
  json: 'json',
  c: 'c',
  java: 'java',
  python: 'python',
  shell: 'bash',
  sql: 'sql',
  csv: 'text',
  html: 'html',
  xml: 'xml',
  url: 'text',
};

function escapeFor(target: string, text: string): string {
  switch (target) {
    case 'javascript':
      return jsEscape(text);
    case 'json':
      return JSON.stringify(text);
    case 'c':
      return cEscape(text);
    case 'java':
      return javaEscape(text);
    case 'python':
      return pyEscape(text);
    case 'shell':
      return shellEscape(text);
    case 'sql':
      return text.replace(/'/g, "''");
    case 'csv':
      return csvEscape(text);
    case 'html':
      return htmlEscape(text);
    case 'xml':
      return xmlEscape(text);
    case 'url':
      return encodeURIComponent(text);
    default:
      return text;
  }
}

function unescapeFor(target: string, text: string): string {
  switch (target) {
    case 'javascript':
      return backslashUnescape(stripQuotes(text, '"\'`'));
    case 'json':
      return jsonUnescape(text);
    case 'c':
    case 'java':
    case 'python':
      return backslashUnescape(stripQuotes(text, '"\''));
    case 'shell':
      return shellUnescape(text);
    case 'sql':
      return sqlUnescape(text);
    case 'csv':
      return csvUnescape(text);
    case 'html':
      return decodeEntities(text, HTML_ENTITIES);
    case 'xml':
      return decodeEntities(text, XML_ENTITIES);
    case 'url':
      return urlUnescape(text);
    default:
      return text;
  }
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };

  const target = String(o.target);
  const mode = String(o.mode);
  const output =
    mode === 'unescape' ? unescapeFor(target, input.text) : escapeFor(target, input.text);

  return {
    output,
    render: 'code',
    language: LANGUAGE[target] ?? 'text',
    stats: {
      target,
      mode,
      'input chars': input.text.length,
      'output chars': output.length,
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
