import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './case-convert.meta';

/** Split arbitrary text into words, handling camelCase and acronym boundaries. */
export function toWords(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_\-./\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

function convert(text: string, target: string): string {
  if (target === 'upper') return text.toUpperCase();
  if (target === 'lower') return text.toLowerCase();
  if (target === 'inverse') {
    return Array.from(text)
      .map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()))
      .join('');
  }
  if (target === 'alternating') {
    let i = 0;
    return Array.from(text)
      .map((c) => {
        if (!/[a-z]/i.test(c)) return c;
        return i++ % 2 ? c.toUpperCase() : c.toLowerCase();
      })
      .join('');
  }
  if (target === 'sentence') {
    return text.toLowerCase().replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, p, c) => p + c.toUpperCase());
  }
  if (target === 'capital') {
    return text.replace(/\b\p{L}[\p{L}']*/gu, (w) => w.charAt(0).toUpperCase() + w.slice(1));
  }
  if (target === 'title') {
    // Whitespace-preserving title case — no camelCase splitting.
    return text
      .split(/(\s+)/)
      .map((seg) => (/^\s+$/.test(seg) || !seg ? seg : cap(seg)))
      .join('');
  }

  const words = toWords(text);
  switch (target) {
    case 'camel':
      return words.map((w, i) => (i === 0 ? w.toLowerCase() : cap(w))).join('');
    case 'pascal':
      return words.map(cap).join('');
    case 'snake':
      return words.map((w) => w.toLowerCase()).join('_');
    case 'constant':
      return words.map((w) => w.toUpperCase()).join('_');
    case 'kebab':
      return words.map((w) => w.toLowerCase()).join('-');
    case 'dot':
      return words.map((w) => w.toLowerCase()).join('.');
    case 'path':
      return words.map((w) => w.toLowerCase()).join('/');
    default:
      return text;
  }
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };
  return { output: convert(input.text, String(o.target)) };
}

const tool: TextToolModule = { meta, run };
export default tool;
