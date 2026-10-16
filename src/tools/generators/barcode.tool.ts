import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { clamp } from '@/lib/format';
import { meta } from './barcode.meta';

/* -------------------------------------------------------------------------- */
/*  Symbology tables — canonical width patterns, expanded to module bit-strings */
/* -------------------------------------------------------------------------- */

/**
 * Code 128 element-width patterns for values 0–106, as six (or, for the stop
 * character, seven) digits of bar/space widths in modules. Index is the code
 * value; index 103 = START A, 104 = START B, 105 = START C, 106 = STOP.
 */
export const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212',
  '221213', '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221',
  '223211', '221132', '221231', '213212', '223112', '312131', '311222', '321122', '321221',
  '312212', '322112', '322211', '212123', '212321', '232121', '111323', '131123', '131321',
  '112313', '132113', '132311', '211313', '231113', '231311', '112133', '112331', '132131',
  '113123', '113321', '133121', '313121', '211331', '231131', '213113', '213311', '213131',
  '311123', '311321', '331121', '312113', '312311', '332111', '314111', '221411', '431111',
  '111224', '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', '111242',
  '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311',
  '113141', '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
] as const;

const CODE128_START_B = 104;
const CODE128_START_C = 105;
const CODE128_STOP = 106;

/**
 * Code 39 element widths — nine elements per character (bar, space, … bar),
 * `n` = narrow (1 module), `w` = wide (2 modules). `*` is the start/stop guard.
 */
export const CODE39_PATTERNS: Record<string, string> = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw',
  B: 'nnwnnwnnw',
  C: 'wnwnnwnnn',
  D: 'nnnnwwnnw',
  E: 'wnnnwwnnn',
  F: 'nnwnwwnnn',
  G: 'nnnnnwwnw',
  H: 'wnnnnwwnn',
  I: 'nnwnnwwnn',
  J: 'nnnnwwwnn',
  K: 'wnnnnnnww',
  L: 'nnwnnnnww',
  M: 'wnwnnnnwn',
  N: 'nnnnwnnww',
  O: 'wnnnwnnwn',
  P: 'nnwnwnnwn',
  Q: 'nnnnnnwww',
  R: 'wnnnnnwwn',
  S: 'nnwnnnwwn',
  T: 'nnnnwnwwn',
  U: 'wwnnnnnnw',
  V: 'nwwnnnnnw',
  W: 'wwwnnnnnn',
  X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw',
  '.': 'wwnnnnwnn',
  ' ': 'nwwnnnwnn',
  $: 'nwnwnwnnn',
  '/': 'nwnwnnnwn',
  '+': 'nwnnnwnwn',
  '%': 'nnnwnwnwn',
  '*': 'nwnnwnwnn',
};

/** Interleaved 2 of 5: five element widths per digit (two wide, three narrow). */
export const ITF_PATTERNS: Record<string, string> = {
  '0': 'nnwwn',
  '1': 'wnnnw',
  '2': 'nwnnw',
  '3': 'wwnnn',
  '4': 'nnwnw',
  '5': 'wnwnn',
  '6': 'nwwnn',
  '7': 'nnnww',
  '8': 'wnnwn',
  '9': 'nwnwn',
};

/** EAN/UPC digit encodings: left odd (L), left even (G) and right (R) parity. */
const EAN_L = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011',
];
const EAN_G = [
  '0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111',
];
const EAN_R = [
  '1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100',
];
/** Parity of the six left-hand digits, selected by the EAN-13 leading digit. */
const EAN13_PARITY = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL',
];

/* -------------------------------------------------------------------------- */
/*  Encoding                                                                  */
/* -------------------------------------------------------------------------- */

/** Expand a numeric width pattern (e.g. "212222") into a '1'/'0' module string. */
function expandWidths(widths: string): string {
  let out = '';
  for (let i = 0; i < widths.length; i++) {
    const w = widths.charCodeAt(i) - 48;
    out += (i % 2 === 0 ? '1' : '0').repeat(w);
  }
  return out;
}

/** Width in modules for a Code 39 / ITF `n`/`w` element. */
const nwWidth = (c: string) => (c === 'w' ? 2 : 1);

/** Expand an `n`/`w` width pattern (bar first) into a '1'/'0' module string. */
function expandNw(pattern: string): string {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    out += (i % 2 === 0 ? '1' : '0').repeat(nwWidth(pattern[i]!));
  }
  return out;
}

/** GTIN mod-10 check digit for a digit-only string (rightmost digit weighed ×3). */
export function gtinCheckDigit(data: string): number {
  let sum = 0;
  let weight = 3;
  for (let i = data.length - 1; i >= 0; i--) {
    sum += (data.charCodeAt(i) - 48) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10;
}

/** Encode Code 128 in subset A, B or C. Returns the module string. */
export function encodeCode128(
  text: string,
  subset: 'auto' | 'B' | 'C',
): { modules: string; start: number; codes: number[]; check: number } {
  if (!text) throw new ToolError('Enter text to encode.', 'A Code 128 symbol needs at least one character.');
  if (text.length > 200)
    throw new ToolError(
      `That is ${text.length} characters — too many for a practical Code 128 symbol.`,
      'Keep it to 200 characters or fewer.',
    );

  const asC = subset === 'C' || (subset === 'auto' && /^\d+$/.test(text) && text.length % 2 === 0);
  let start: number;
  const codes: number[] = [];

  if (asC) {
    if (!/^\d+$/.test(text))
      throw new ToolError(
        'Code 128 C only encodes digits.',
        'Use Code 128 B or Auto for letters and symbols.',
      );
    if (text.length % 2 !== 0)
      throw new ToolError(
        'Code 128 C needs an even number of digits.',
        'Add or remove a digit, or use Code 128 Auto.',
      );
    start = CODE128_START_C;
    for (let i = 0; i < text.length; i += 2) codes.push(Number(text.slice(i, i + 2)));
  } else {
    for (const ch of text) {
      const cc = ch.charCodeAt(0);
      if (cc < 32 || cc > 126)
        throw new ToolError(
          `"${ch}" cannot be encoded in Code 128.`,
          'Code 128 B covers printable ASCII (letters, digits, punctuation and space).',
        );
      codes.push(cc - 32);
    }
    start = CODE128_START_B;
  }

  let sum = start;
  codes.forEach((v, i) => (sum += v * (i + 1)));
  const check = sum % 103;

  const modules =
    expandWidths(CODE128_PATTERNS[start]!) +
    codes.map((v) => expandWidths(CODE128_PATTERNS[v]!)).join('') +
    expandWidths(CODE128_PATTERNS[check]!) +
    expandWidths(CODE128_PATTERNS[CODE128_STOP]!);

  return { modules, start, codes, check };
}

/** Encode Code 39 (start `*`, data, stop `*`, narrow inter-character gaps). */
export function encodeCode39(text: string): string {
  if (!text) throw new ToolError('Enter text to encode.', 'A Code 39 symbol needs at least one character.');
  if (text.length > 100)
    throw new ToolError(
      `That is ${text.length} characters — too many for a practical Code 39 symbol.`,
      'Keep it to 100 characters or fewer.',
    );
  const chars = ['*', ...text, '*'];
  let modules = '';
  chars.forEach((ch, idx) => {
    const pattern = CODE39_PATTERNS[ch];
    if (!pattern)
      throw new ToolError(
        `Code 39 cannot encode "${ch}".`,
        'Allowed: 0–9, A–Z, space and - . $ / + % (lower-case is converted to upper-case).',
      );
    modules += expandNw(pattern);
    if (idx < chars.length - 1) modules += '0'; // one narrow inter-character space
  });
  return modules;
}

/** Encode a full 13-digit EAN-13 payload. */
export function encodeEan13(digits: string): { modules: string; guard: Set<number> } {
  const parity = EAN13_PARITY[Number(digits[0])]!;
  let modules = '101';
  for (let i = 0; i < 6; i++) {
    const d = Number(digits[i + 1]);
    modules += parity[i] === 'L' ? EAN_L[d]! : EAN_G[d]!;
  }
  modules += '01010';
  for (let i = 7; i < 13; i++) modules += EAN_R[Number(digits[i])]!;
  modules += '101';
  return { modules, guard: new Set([0, 1, 2, 45, 46, 47, 48, 49, 92, 93, 94]) };
}

/** Encode a full 8-digit EAN-8 payload. */
export function encodeEan8(digits: string): { modules: string; guard: Set<number> } {
  let modules = '101';
  for (let i = 0; i < 4; i++) modules += EAN_L[Number(digits[i])]!;
  modules += '01010';
  for (let i = 4; i < 8; i++) modules += EAN_R[Number(digits[i])]!;
  modules += '101';
  return { modules, guard: new Set([0, 1, 2, 31, 32, 33, 34, 35, 64, 65, 66]) };
}

/** Encode a full 12-digit UPC-A payload (EAN-13 with a leading zero). */
export function encodeUpcA(digits: string): { modules: string; guard: Set<number> } {
  return encodeEan13(`0${digits}`);
}

/** Encode an even-length digit string as Interleaved 2 of 5. */
export function encodeItf(digits: string): string {
  if (!/^\d+$/.test(digits) || digits.length % 2 !== 0)
    throw new ToolError(
      'Interleaved 2 of 5 needs an even number of digits.',
      `Received ${digits.length} digit${digits.length === 1 ? '' : 's'}.`,
    );
  if (digits.length > 80)
    throw new ToolError(
      `That is ${digits.length} digits — too long for a practical ITF symbol.`,
      'Keep it to 80 digits or fewer.',
    );
  let modules = '1010'; // start: four narrow elements
  for (let i = 0; i < digits.length; i += 2) {
    const bars = ITF_PATTERNS[digits[i]!]!;
    const spaces = ITF_PATTERNS[digits[i + 1]!]!;
    for (let k = 0; k < 5; k++) {
      modules += '1'.repeat(nwWidth(bars[k]!));
      modules += '0'.repeat(nwWidth(spaces[k]!));
    }
  }
  modules += '1101'; // stop: wide bar, narrow space, narrow bar
  return modules;
}

/* -------------------------------------------------------------------------- */
/*  Input normalisation per symbology                                         */
/* -------------------------------------------------------------------------- */

const SYMBOLOGY_NAMES: Record<string, string> = {
  code128: 'Code 128',
  code128b: 'Code 128 B',
  code128c: 'Code 128 C',
  code39: 'Code 39',
  ean13: 'EAN-13',
  ean8: 'EAN-8',
  upca: 'UPC-A',
  itf14: 'ITF-14',
  itf: 'Interleaved 2 of 5',
};

const NUMERIC_HINT = 'Digits 0–9 only — spaces and dashes are ignored.';

function numeric(raw: string, label: string): string {
  const s = raw.trim().replace(/[\s-]/g, '');
  if (!s) throw new ToolError('Enter a number to encode.', `Type the ${label} value to encode.`);
  if (!/^\d+$/.test(s))
    throw new ToolError(`"${raw.trim()}" is not a valid ${label} value.`, NUMERIC_HINT);
  return s;
}

/** Normalise a GTIN-style payload to `dataLen` data digits plus a check digit. */
function gtin(raw: string, label: string, dataLen: number): string {
  let s = numeric(raw, label);
  if (s.length === dataLen) {
    s += String(gtinCheckDigit(s));
  } else if (s.length === dataLen + 1) {
    const expected = gtinCheckDigit(s.slice(0, dataLen));
    if (Number(s[dataLen]) !== expected)
      throw new ToolError(
        `That ${label} has an invalid check digit.`,
        `The last digit should be ${expected}: try "${s.slice(0, dataLen)}${expected}".`,
      );
  } else {
    throw new ToolError(
      `${label} needs ${dataLen} or ${dataLen + 1} digits (got ${s.length}).`,
      `Enter the ${dataLen}-digit data and the check digit is added for you.`,
    );
  }
  return s;
}

export interface EncodedBarcode {
  symbology: string;
  /** The module string ('1' = bar, '0' = space) at single-module resolution. */
  modules: string;
  /** The text a human would read off the symbol. */
  humanText: string;
  /** Module indices drawn as extended guard bars (EAN/UPC only). */
  guard: Set<number>;
  /** Per-digit text cells (EAN/UPC) as centre positions in modules, or null. */
  cells: { ch: string; center: number }[] | null;
  /** Minimum quiet-zone width in modules needed for legibility. */
  minMargin: number;
}

/** Validate and encode `raw` for the chosen symbology. Throws ToolError on bad input. */
export function buildBarcode(symbology: string, raw: string): EncodedBarcode {
  switch (symbology) {
    case 'code128b': {
      const { modules } = encodeCode128(raw.trim(), 'B');
      return {
        symbology,
        modules,
        humanText: raw.trim(),
        guard: new Set(),
        cells: null,
        minMargin: 0,
      };
    }
    case 'code128c': {
      const { modules } = encodeCode128(raw.trim(), 'C');
      return {
        symbology,
        modules,
        humanText: raw.trim(),
        guard: new Set(),
        cells: null,
        minMargin: 0,
      };
    }
    case 'code39': {
      const text = raw.trim().toUpperCase();
      const modules = encodeCode39(text);
      return { symbology, modules, humanText: text, guard: new Set(), cells: null, minMargin: 0 };
    }
    case 'ean13': {
      const digits = gtin(raw, 'EAN-13', 12);
      const { modules, guard } = encodeEan13(digits);
      const cells = [{ ch: digits[0]!, center: -3.5 }];
      for (let i = 0; i < 6; i++) cells.push({ ch: digits[i + 1]!, center: 6.5 + 7 * i });
      for (let j = 0; j < 6; j++) cells.push({ ch: digits[j + 7]!, center: 53.5 + 7 * j });
      return { symbology, modules, humanText: digits, guard, cells, minMargin: 7 };
    }
    case 'ean8': {
      const digits = gtin(raw, 'EAN-8', 7);
      const { modules, guard } = encodeEan8(digits);
      const cells: { ch: string; center: number }[] = [];
      for (let i = 0; i < 4; i++) cells.push({ ch: digits[i]!, center: 6.5 + 7 * i });
      for (let j = 0; j < 4; j++) cells.push({ ch: digits[j + 4]!, center: 39.5 + 7 * j });
      return { symbology, modules, humanText: digits, guard, cells, minMargin: 0 };
    }
    case 'upca': {
      const digits = gtin(raw, 'UPC-A', 11);
      const { modules, guard } = encodeUpcA(digits);
      const cells = [{ ch: digits[0]!, center: -3.5 }];
      for (let j = 0; j < 5; j++) cells.push({ ch: digits[j + 1]!, center: 13.5 + 7 * j });
      for (let j = 0; j < 5; j++) cells.push({ ch: digits[j + 6]!, center: 53.5 + 7 * j });
      cells.push({ ch: digits[11]!, center: 98.5 });
      return { symbology, modules, humanText: digits, guard, cells, minMargin: 7 };
    }
    case 'itf14': {
      const digits = gtin(raw, 'ITF-14', 13);
      const modules = encodeItf(digits);
      return {
        symbology,
        modules,
        humanText: digits,
        guard: new Set(),
        cells: null,
        minMargin: 0,
      };
    }
    case 'itf': {
      const digits = numeric(raw, 'Interleaved 2 of 5');
      if (digits.length % 2 !== 0)
        throw new ToolError(
          'Interleaved 2 of 5 needs an even number of digits.',
          `Received ${digits.length} digit${digits.length === 1 ? '' : 's'}. Add or remove one.`,
        );
      const modules = encodeItf(digits);
      return {
        symbology,
        modules,
        humanText: digits,
        guard: new Set(),
        cells: null,
        minMargin: 0,
      };
    }
    default: {
      const text = raw.trim();
      const { modules } = encodeCode128(text, 'auto');
      return { symbology: 'code128', modules, humanText: text, guard: new Set(), cells: null, minMargin: 0 };
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  SVG rendering                                                             */
/* -------------------------------------------------------------------------- */

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isTransparent(c: string): boolean {
  const v = c.trim().toLowerCase();
  return v === 'none' || v === 'transparent' || v === '';
}

export interface RenderOptions {
  moduleWidth: number;
  height: number;
  showText: boolean;
  quietZone: number;
  color: string;
  background: string;
}

/** Render an encoded barcode as a standalone SVG document string. */
export function renderSvg(encoded: EncodedBarcode, opts: RenderOptions): string {
  const mw = clamp(Math.round(opts.moduleWidth), 1, 6);
  const barH = clamp(Math.round(opts.height), 20, 240);
  const showText = opts.showText;
  const { modules, guard, cells, humanText } = encoded;
  const n = modules.length;

  const quiet = Math.max(clamp(Math.round(opts.quietZone), 0, 24), showText ? encoded.minMargin : 0);
  const width = (n + 2 * quiet) * mw;

  // Font size: legible but never wider than its cell / the whole symbol.
  const preferred = clamp(Math.round(barH * 0.3), 9, 32);
  let fontSize = preferred;
  if (showText) {
    const cellWidthModules = cells ? 7 : n / Math.max(1, humanText.length);
    const fit = Math.floor((cellWidthModules * mw) / 0.62);
    fontSize = Math.max(6, Math.min(preferred, fit));
  }
  const textArea = showText ? Math.round(fontSize * 1.45) : 0;
  const height = barH + textArea;
  const baseline = barH + Math.round(fontSize * 0.95);
  const guardExt = Math.round(fontSize * 0.8);
  const barHeightFor = (tall: boolean) => (tall && showText ? barH + guardExt : barH);

  const rects: string[] = [];
  for (let i = 0; i < n; ) {
    if (modules[i] !== '1') {
      i++;
      continue;
    }
    const tall = guard.has(i);
    let j = i;
    while (j < n && modules[j] === '1' && guard.has(j) === tall) j++;
    rects.push(
      `<rect x="${(quiet + i) * mw}" y="0" width="${(j - i) * mw}" height="${barHeightFor(tall)}"/>`,
    );
    i = j;
  }

  let text = '';
  if (showText) {
    const label = `${escapeXml(humanText)}`;
    if (cells) {
      text = cells
        .map(
          (c) =>
            `<text x="${(quiet + c.center) * mw}" y="${baseline}" text-anchor="middle">${escapeXml(
              c.ch,
            )}</text>`,
        )
        .join('');
    } else {
      text = `<text x="${width / 2}" y="${baseline}" text-anchor="middle">${label}</text>`;
    }
  }

  const bg = isTransparent(opts.background)
    ? ''
    : `<rect width="${width}" height="${height}" fill="${opts.background}"/>`;

  const name = SYMBOLOGY_NAMES[encoded.symbology] ?? 'Barcode';
  const aria = `${name} barcode for ${humanText}`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges" role="img" ` +
    `aria-label="${escapeXml(aria)}">` +
    bg +
    `<g fill="${opts.color}">${rects.join('')}</g>` +
    (text
      ? `<g fill="${opts.color}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="${fontSize}">${text}</g>`
      : '') +
    `</svg>`
  );
}

/** Base64-encode an (ASCII) SVG string as an `image/svg+xml` data URI. */
export function svgDataUri(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

/* -------------------------------------------------------------------------- */
/*  Tool entry point                                                          */
/* -------------------------------------------------------------------------- */

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const symbology = String(o.symbology ?? 'code128');
  if (!(symbology in SYMBOLOGY_NAMES))
    throw new ToolError(`Unknown symbology "${symbology}".`, 'Pick one from the list.');

  const color = String(o.color ?? '#000000').trim();
  const background = String(o.background ?? '#ffffff').trim();
  if (!HEX.test(color))
    throw new ToolError(
      `"${color}" is not a hex colour.`,
      'Enter the bar colour as #rgb, #rrggbb or #rrggbbaa.',
    );
  if (!isTransparent(background) && !HEX.test(background))
    throw new ToolError(
      `"${background}" is not a hex colour.`,
      'Enter the background as a hex colour, or "none" for transparent.',
    );

  const encoded = buildBarcode(symbology, input.text);
  const svg = renderSvg(encoded, {
    moduleWidth: Number(o.moduleWidth ?? 2),
    height: Number(o.height ?? 80),
    showText: Boolean(o.showText ?? true),
    quietZone: Number(o.quietZone ?? 10),
    color,
    background,
  });

  const name = SYMBOLOGY_NAMES[encoded.symbology]!;
  return {
    output: svgDataUri(svg),
    render: 'image',
    filename: `${encoded.symbology}-barcode.svg`,
    stats: {
      Symbology: name,
      Modules: encoded.modules.length,
      Text: encoded.humanText,
    },
    notes: [
      'Print at 100% scale — shrinking the barcode blurs the bars and can stop it scanning.',
    ],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
