import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './color-blend.meta';

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

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const clampByte = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360;
  s = clamp01(s);
  l = clamp01(l);
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
    'Try #3b82f6, rgb(59 130 246), hsl(217 91% 60%) or a CSS colour name.',
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

function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = 60 * (((gn - bn) / d) % 6);
  else if (max === gn) h = 60 * ((bn - rn) / d + 2);
  else h = 60 * ((rn - gn) / d + 4);
  if (h < 0) h += 360;
  return { h, s, l };
}

const hexOf = (c: RGB) =>
  `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const text = input.text.trim();
  if (!text) return { output: '' };

  const a = parse(text);
  const b = parse(String(o.second));
  const t = Math.max(0, Math.min(100, Number(o.ratio) || 0)) / 100;

  let blended: RGB;
  if (String(o.space) === 'hsl') {
    const ha = rgbToHsl(a);
    const hb = rgbToHsl(b);
    let dh = ((hb.h - ha.h + 540) % 360) - 180; // shorter arc, in (-180, 180]
    const h = (((ha.h + dh * t) % 360) + 360) % 360;
    blended = hslToRgb(h, lerp(ha.s, hb.s, t), lerp(ha.l, hb.l, t));
  } else {
    blended = {
      r: Math.round(lerp(a.r, b.r, t)),
      g: Math.round(lerp(a.g, b.g, t)),
      b: Math.round(lerp(a.b, b.b, t)),
    };
  }

  const hx = rgbToHsl(blended);
  const rgbStr = `rgb(${blended.r}, ${blended.g}, ${blended.b})`;
  const hslStr = `hsl(${Math.round(hx.h)}, ${Math.round(hx.s * 100)}%, ${Math.round(hx.l * 100)}%)`;

  return {
    output: JSON.stringify([hexOf(a), hexOf(blended), hexOf(b)]),
    render: 'colors',
    stats: { blended: `${hexOf(blended)} · ${rgbStr} · ${hslStr}` },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
