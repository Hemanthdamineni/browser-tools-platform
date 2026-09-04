import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './punycode.meta';

/* -------------------------------------------------------------------------- */
/*  RFC 3492 Punycode (port of the canonical reference implementation)         */
/* -------------------------------------------------------------------------- */

const BASE = 36;
const TMIN = 1;
const TMAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128;

const digitToBasic = (d: number): number => (d < 26 ? d + 97 : d + 22); // 0..25 → a..z, 26..35 → 0..9

const basicToDigit = (cp: number): number => {
  if (cp >= 48 && cp < 58) return cp - 22; // '0'..'9' → 26..35
  if (cp >= 65 && cp < 91) return cp - 65; // 'A'..'Z' → 0..25
  if (cp >= 97 && cp < 123) return cp - 97; // 'a'..'z' → 0..25
  return BASE; // invalid marker
};

function adapt(delta: number, numPoints: number, firstTime: boolean): number {
  delta = firstTime ? Math.floor(delta / DAMP) : delta >> 1;
  delta += Math.floor(delta / numPoints);
  let k = 0;
  while (delta > ((BASE - TMIN) * TMAX) >> 1) {
    delta = Math.floor(delta / (BASE - TMIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - TMIN + 1) * delta) / (delta + SKEW));
}

function encodePart(input: string): string {
  const cps = Array.from(input).map((c) => c.codePointAt(0)!);
  const output: number[] = [];
  for (const cp of cps) if (cp < 0x80) output.push(cp);
  let b = output.length;
  let h = b;
  if (b > 0) output.push(0x2d); // '-'
  let n = INITIAL_N;
  let delta = 0;
  let bias = INITIAL_BIAS;

  while (h < cps.length) {
    const m = Math.min(...cps.filter((cp) => cp >= n));
    delta += (m - n) * (h + 1);
    n = m;
    for (const cp of cps) {
      if (cp < n) delta++;
      if (cp === n) {
        let q = delta;
        for (let k = BASE; ; k += BASE) {
          const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
          if (q < t) break;
          output.push(digitToBasic(t + ((q - t) % (BASE - t))));
          q = Math.floor((q - t) / (BASE - t));
        }
        output.push(digitToBasic(q));
        bias = adapt(delta, h + 1, h === b);
        delta = 0;
        h++;
      }
    }
    delta++;
    n++;
  }
  return String.fromCodePoint(...output);
}

function decodePart(input: string): string {
  const cps = Array.from(input).map((c) => c.codePointAt(0)!);
  let pos = 0;
  const output: number[] = [];
  const lastDelim = input.lastIndexOf('-');
  if (lastDelim > 0) {
    for (; pos < lastDelim; pos++) output.push(cps[pos]!);
    pos++; // skip the delimiter
  }
  let n = INITIAL_N;
  let i = 0;
  let bias = INITIAL_BIAS;

  while (pos < cps.length) {
    const oldi = i;
    let w = 1;
    for (let k = BASE; ; k += BASE) {
      if (pos >= cps.length) throw new Error('Truncated punycode');
      const digit = basicToDigit(cps[pos++]!);
      if (digit >= BASE) throw new Error('Invalid digit');
      i += digit * w;
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
      if (digit < t) break;
      w *= BASE - t;
    }
    bias = adapt(i - oldi, output.length + 1, oldi === 0);
    n += Math.floor(i / (output.length + 1));
    i %= output.length + 1;
    output.splice(i, 0, n);
    i++;
  }
  return String.fromCodePoint(...output);
}

/* ------------------------------ domain wrapper ----------------------------- */

const isAscii = (s: string) => {
  for (const ch of s) if (ch.charCodeAt(0) > 0x7f) return false;
  return true;
};

function toAscii(domain: string): string {
  return domain
    .split('.')
    .map((label) => {
      if (isAscii(label)) return label;
      return `xn--${encodePart(label)}`;
    })
    .join('.');
}

function toUnicode(domain: string): string {
  return domain
    .split('.')
    .map((label) => {
      if (!/^xn--/i.test(label)) return label;
      const encoded = label.slice(4);
      try {
        return decodePart(encoded);
      } catch {
        throw new ToolError('Invalid Punycode label.', encoded);
      }
    })
    .join('.');
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text.trim()) return { output: '' };
  const domain = input.text.trim();
  return {
    output: o.mode === 'to-ascii' ? toAscii(domain) : toUnicode(domain),
    render: 'text',
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
