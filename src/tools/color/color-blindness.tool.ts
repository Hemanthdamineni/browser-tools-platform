import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './color-blindness.meta';

interface RGB {
  r: number;
  g: number;
  b: number;
}

/* Self-contained colour parser: #rgb/#rgba/#rrggbb/#rrggbbaa, rgb()/rgba(),
   hsl()/hsla(), and the 148 CSS named colours. */
const NAMED: Record<string, string> = {
  aliceblue: '#f0f8ff',
  antiquewhite: '#faebd7',
  aqua: '#00ffff',
  aquamarine: '#7fffd4',
  azure: '#f0ffff',
  beige: '#f5f5dc',
  bisque: '#ffe4c4',
  black: '#000000',
  blanchedalmond: '#ffebcd',
  blue: '#0000ff',
  blueviolet: '#8a2be2',
  brown: '#a52a2a',
  burlywood: '#deb887',
  cadetblue: '#5f9ea0',
  chartreuse: '#7fff00',
  chocolate: '#d2691e',
  coral: '#ff7f50',
  cornflowerblue: '#6495ed',
  cornsilk: '#fff8dc',
  crimson: '#dc143c',
  cyan: '#00ffff',
  darkblue: '#00008b',
  darkcyan: '#008b8b',
  darkgoldenrod: '#b8860b',
  darkgray: '#a9a9a9',
  darkgreen: '#006400',
  darkgrey: '#a9a9a9',
  darkkhaki: '#bdb76b',
  darkmagenta: '#8b008b',
  darkolivegreen: '#556b2f',
  darkorange: '#ff8c00',
  darkorchid: '#9932cc',
  darkred: '#8b0000',
  darksalmon: '#e9967a',
  darkseagreen: '#8fbc8f',
  darkslateblue: '#483d8b',
  darkslategray: '#2f4f4f',
  darkslategrey: '#2f4f4f',
  darkturquoise: '#00ced1',
  darkviolet: '#9400d3',
  deeppink: '#ff1493',
  deepskyblue: '#00bfff',
  dimgray: '#696969',
  dimgrey: '#696969',
  dodgerblue: '#1e90ff',
  firebrick: '#b22222',
  floralwhite: '#fffaf0',
  forestgreen: '#228b22',
  fuchsia: '#ff00ff',
  gainsboro: '#dcdcdc',
  ghostwhite: '#f8f8ff',
  gold: '#ffd700',
  goldenrod: '#daa520',
  gray: '#808080',
  green: '#008000',
  greenyellow: '#adff2f',
  grey: '#808080',
  honeydew: '#f0fff0',
  hotpink: '#ff69b4',
  indianred: '#cd5c5c',
  indigo: '#4b0082',
  ivory: '#fffff0',
  khaki: '#f0e68c',
  lavender: '#e6e6fa',
  lavenderblush: '#fff0f5',
  lawngreen: '#7cfc00',
  lemonchiffon: '#fffacd',
  lightblue: '#add8e6',
  lightcoral: '#f08080',
  lightcyan: '#e0ffff',
  lightgoldenrodyellow: '#fafad2',
  lightgray: '#d3d3d3',
  lightgreen: '#90ee90',
  lightgrey: '#d3d3d3',
  lightpink: '#ffb6c1',
  lightsalmon: '#ffa07a',
  lightseagreen: '#20b2aa',
  lightskyblue: '#87cefa',
  lightslategray: '#778899',
  lightslategrey: '#778899',
  lightsteelblue: '#b0c4de',
  lightyellow: '#ffffe0',
  lime: '#00ff00',
  limegreen: '#32cd32',
  linen: '#faf0e6',
  magenta: '#ff00ff',
  maroon: '#800000',
  mediumaquamarine: '#66cdaa',
  mediumblue: '#0000cd',
  mediumorchid: '#ba55d3',
  mediumpurple: '#9370db',
  mediumseagreen: '#3cb371',
  mediumslateblue: '#7b68ee',
  mediumspringgreen: '#00fa9a',
  mediumturquoise: '#48d1cc',
  mediumvioletred: '#c71585',
  midnightblue: '#191970',
  mintcream: '#f5fffa',
  mistyrose: '#ffe4e1',
  moccasin: '#ffe4b5',
  navajowhite: '#ffdead',
  navy: '#000080',
  oldlace: '#fdf5e6',
  olive: '#808000',
  olivedrab: '#6b8e23',
  orange: '#ffa500',
  orangered: '#ff4500',
  orchid: '#da70d6',
  palegoldenrod: '#eee8aa',
  palegreen: '#98fb98',
  paleturquoise: '#afeeee',
  palevioletred: '#db7093',
  papayawhip: '#ffefd5',
  peachpuff: '#ffdab9',
  peru: '#cd853f',
  pink: '#ffc0cb',
  plum: '#dda0dd',
  powderblue: '#b0e0e6',
  purple: '#800080',
  rebeccapurple: '#663399',
  red: '#ff0000',
  rosybrown: '#bc8f8f',
  royalblue: '#4169e1',
  saddlebrown: '#8b4513',
  salmon: '#fa8072',
  sandybrown: '#f4a460',
  seagreen: '#2e8b57',
  seashell: '#fff5ee',
  sienna: '#a0522d',
  silver: '#c0c0c0',
  skyblue: '#87ceeb',
  slateblue: '#6a5acd',
  slategray: '#708090',
  slategrey: '#708090',
  snow: '#fffafa',
  springgreen: '#00ff7f',
  steelblue: '#4682b4',
  tan: '#d2b48c',
  teal: '#008080',
  thistle: '#d8bfd8',
  tomato: '#ff6347',
  turquoise: '#40e0d0',
  violet: '#ee82ee',
  wheat: '#f5deb3',
  white: '#ffffff',
  whitesmoke: '#f5f5f5',
  yellow: '#ffff00',
  yellowgreen: '#9acd32',
};

const clampByte = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return {
    r: clampByte((r1 + m) * 255),
    g: clampByte((g1 + m) * 255),
    b: clampByte((b1 + m) * 255),
  };
}

function bad(raw: string): never {
  throw new ToolError(
    `"${raw}" is not a colour.`,
    'Enter one colour per line, e.g. #3b82f6 or tomato.',
  );
}

function parse(input: string): RGB {
  const raw = input.trim();
  if (!raw) bad(raw);
  let s = raw.toLowerCase();
  if (s in NAMED) s = NAMED[s]!;

  const hex = /^#?([0-9a-f]{3,8})$/.exec(s);
  if (hex) {
    let h = hex[1]!;
    if (h.length === 3 || h.length === 4) h = Array.from(h, (c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) bad(raw);
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  const rgb = /^rgba?\(([^)]+)\)$/.exec(s);
  if (rgb) {
    const p = rgb[1]!.split(/[\s,/]+/).filter(Boolean);
    if (p.length < 3) bad(raw);
    const byte = (v: string) => (v.endsWith('%') ? (parseFloat(v) / 100) * 255 : parseFloat(v));
    const vals = p.slice(0, 3).map(byte);
    if (vals.some((v) => !Number.isFinite(v))) bad(raw);
    return { r: clampByte(vals[0]!), g: clampByte(vals[1]!), b: clampByte(vals[2]!) };
  }

  const hsl = /^hsla?\(([^)]+)\)$/.exec(s);
  if (hsl) {
    const p = hsl[1]!.split(/[\s,/]+/).filter(Boolean);
    if (p.length < 3) bad(raw);
    const part = (v: string) => {
      const n = v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v);
      return n > 1 && !v.endsWith('%') ? n / 100 : n;
    };
    const hue = parseFloat(p[0]!);
    const sat = part(p[1]!);
    const lig = part(p[2]!);
    if (![hue, sat, lig].every(Number.isFinite)) bad(raw);
    return hslToRgb(hue, sat, lig);
  }

  bad(raw);
}

const hexOf = (c: RGB) =>
  `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/* sRGB <-> linear and the Viénot/Brettel linear-RGB simulation matrices. */
const toLinear = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const toSrgbByte = (v: number) => {
  const s = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return clampByte(s * 255);
};

const MATRICES: Record<string, number[][]> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

function simulate(c: RGB, type: string, severity: number): RGB {
  const t = severity / 100;
  let sim: RGB;
  if (type === 'achromatopsia') {
    const lin = [toLinear(c.r), toLinear(c.g), toLinear(c.b)];
    const y = 0.2126729 * lin[0]! + 0.7151522 * lin[1]! + 0.072175 * lin[2]!;
    const g = toSrgbByte(y);
    sim = { r: g, g, b: g };
  } else {
    const m = MATRICES[type]!;
    const lin = [toLinear(c.r), toLinear(c.g), toLinear(c.b)];
    sim = {
      r: toSrgbByte(m[0]![0]! * lin[0]! + m[0]![1]! * lin[1]! + m[0]![2]! * lin[2]!),
      g: toSrgbByte(m[1]![0]! * lin[0]! + m[1]![1]! * lin[1]! + m[1]![2]! * lin[2]!),
      b: toSrgbByte(m[2]![0]! * lin[0]! + m[2]![1]! * lin[1]! + m[2]![2]! * lin[2]!),
    };
  }
  return {
    r: Math.round(c.r + (sim.r - c.r) * t),
    g: Math.round(c.g + (sim.g - c.g) * t),
    b: Math.round(c.b + (sim.b - c.b) * t),
  };
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const text = input.text.trim();
  if (!text) return { output: '' };

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const originals: RGB[] = [];
  for (const line of lines) originals.push(parse(line));
  if (originals.length === 0) throw new ToolError('Enter at least one colour.');

  const type = String(o.type);
  const severity = Math.max(0, Math.min(100, Number(o.severity) ?? 100));
  const simulated = originals.map((c) => simulate(c, type, severity));

  return {
    output: JSON.stringify(simulated.map(hexOf)),
    render: 'colors',
    stats: { type, severity: `${severity}%`, colors: originals.length },
    notes: [`Original: ${originals.map(hexOf).join(', ')}`],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
