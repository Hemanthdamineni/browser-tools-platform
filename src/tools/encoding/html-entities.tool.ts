import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './html-entities.meta';

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  copy: '©',
  reg: '®',
  trade: '™',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  deg: '°',
  plusmn: '±',
  times: '×',
  divide: '÷',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  sup2: '²',
  sup3: '³',
  micro: 'µ',
  para: '¶',
  sect: '§',
  middot: '·',
  bull: '•',
  dagger: '†',
  Dagger: '‡',
  euro: '€',
  pound: '£',
  cent: '¢',
  yen: '¥',
  curren: '¤',
  iexcl: '¡',
  iquest: '¿',
  agrave: 'à',
  aacute: 'á',
  acirc: 'â',
  atilde: 'ã',
  auml: 'ä',
  aring: 'å',
  aelig: 'æ',
  ccedil: 'ç',
  egrave: 'è',
  eacute: 'é',
  ecirc: 'ê',
  euml: 'ë',
  igrave: 'ì',
  iacute: 'í',
  icirc: 'î',
  iuml: 'ï',
  ntilde: 'ñ',
  ograve: 'ò',
  oacute: 'ó',
  ocirc: 'ô',
  otilde: 'õ',
  ouml: 'ö',
  oslash: 'ø',
  ugrave: 'ù',
  uacute: 'ú',
  ucirc: 'û',
  uuml: 'ü',
  yuml: 'ÿ',
  szlig: 'ß',
  Agrave: 'À',
  Aacute: 'Á',
  Acirc: 'Â',
  Auml: 'Ä',
  Ccedil: 'Ç',
  Eacute: 'É',
  Euml: 'Ë',
  Ntilde: 'Ñ',
  Ouml: 'Ö',
  Uuml: 'Ü',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  theta: 'θ',
  lambda: 'λ',
  mu: 'μ',
  pi: 'π',
  sigma: 'σ',
  phi: 'φ',
  omega: 'ω',
  Delta: 'Δ',
  Sigma: 'Σ',
  Omega: 'Ω',
  Pi: 'Π',
  infin: '∞',
  ne: '≠',
  le: '≤',
  ge: '≥',
  asymp: '≈',
  equiv: '≡',
  sum: '∑',
  prod: '∏',
  radic: '√',
  part: '∂',
  nabla: '∇',
  isin: '∈',
  notin: '∉',
  empty: '∅',
  and: '∧',
  or: '∨',
  not: '¬',
  rarr: '→',
  larr: '←',
  uarr: '↑',
  darr: '↓',
  harr: '↔',
  rArr: '⇒',
  lArr: '⇐',
  hearts: '♥',
  spades: '♠',
  clubs: '♣',
  diams: '♦',
  star: '☆',
  check: '✓',
  cross: '✗',
  zwnj: '‌',
  zwj: '‍',
  shy: '­',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
};

const REVERSE_MIN: Array<[RegExp, string]> = [
  [/&/g, '&amp;'],
  [/</g, '&lt;'],
  [/>/g, '&gt;'],
  [/"/g, '&quot;'],
  [/'/g, '&#39;'],
];

function encode(text: string, nonAscii: boolean): string {
  let out = text;
  for (const [re, rep] of REVERSE_MIN) out = out.replace(re, rep);
  if (nonAscii) {
    out = Array.from(out)
      .map((ch) => {
        const cp = ch.codePointAt(0)!;
        return cp > 127 ? `&#${cp};` : ch;
      })
      .join('');
  }
  return out;
}

function decode(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body: string) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (Number.isNaN(code) || code < 0 || code > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    return Object.prototype.hasOwnProperty.call(NAMED, body) ? NAMED[body]! : whole;
  });
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text) return { output: '' };
  if (o.mode === 'decode') {
    return { output: decode(input.text) };
  }
  const out = encode(input.text, o.level === 'non-ascii');
  return { output: out, render: 'code', language: 'html' };
}

const tool: TextToolModule = { meta, run };
export default tool;
