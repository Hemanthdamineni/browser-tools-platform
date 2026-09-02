import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './unicode-escape.meta';

function hex(n: number, width: number): string {
  return n.toString(16).toUpperCase().padStart(width, '0');
}

function escapeChar(cp: number, style: string): string {
  switch (style) {
    case 'python':
      return cp > 0xffff ? `\\U${hex(cp, 8)}` : `\\u${hex(cp, 4)}`;
    case 'css':
      return `\\${hex(cp, 6)} `;
    case 'html':
      return `&#x${hex(cp, 4)};`;
    case 'unicode-plus':
      return `U+${hex(cp, 4)}`;
    default: {
      // JavaScript / JSON
      if (cp > 0xffff) {
        const h = cp - 0x10000;
        const hi = 0xd800 + (h >> 10);
        const lo = 0xdc00 + (h & 0x3ff);
        return `\\u${hex(hi, 4)}\\u${hex(lo, 4)}`;
      }
      return `\\u${hex(cp, 4)}`;
    }
  }
}

function doEscape(text: string, style: string, all: boolean): string {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (all || cp > 127) out += escapeChar(cp, style);
    else out += ch;
  }
  return out;
}

function doUnescape(text: string): string {
  let out = text;
  // \u{XXXXX}
  out = out.replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (_, h) => cp(h));
  // \uXXXX  (handle surrogate pairs afterwards via normalize step below)
  out = out.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => cp(h));
  // \U00XXXXXX (python)
  out = out.replace(/\\U([0-9a-fA-F]{8})/g, (_, h) => cp(h));
  // \xXX
  out = out.replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => cp(h));
  // U+XXXX
  out = out.replace(/U\+([0-9a-fA-F]{4,6})/g, (_, h) => cp(h));
  // &#DDDD; and &#xHHHH;
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => cp(h));
  out = out.replace(/&#(\d+);/g, (_, d) => cp(parseInt(d, 10).toString(16)));
  // CSS \HHHHHH (1-6 hex, optional trailing space)
  out = out.replace(/\\([0-9a-fA-F]{1,6}) ?/g, (_, h) => cp(h));
  // Combine any leftover surrogate pairs that came from separate \uXXXX escapes
  out = out.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, (m) => m);
  return out;
}

function cp(hexStr: string): string {
  const n = parseInt(hexStr, 16);
  if (Number.isNaN(n) || n < 0 || n > 0x10ffff) return '';
  try {
    return String.fromCodePoint(n);
  } catch {
    return '';
  }
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };
  if (o.mode === 'unescape') {
    return { output: doUnescape(input.text) };
  }
  const out = doEscape(input.text, String(o.style), o.which === 'all');
  return { output: out, render: 'code' };
}

const tool: TextToolModule = { meta, run };
export default tool;
