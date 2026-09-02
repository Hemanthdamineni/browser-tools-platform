import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { meta } from './color-convert.meta';

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

const NAMED: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  lime: '#00ff00',
  navy: '#000080',
  teal: '#008080',
  aqua: '#00ffff',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  fuchsia: '#ff00ff',
  yellow: '#ffff00',
  orange: '#ffa500',
  purple: '#800080',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
  maroon: '#800000',
  olive: '#808000',
  pink: '#ffc0cb',
  gold: '#ffd700',
  indigo: '#4b0082',
  violet: '#ee82ee',
  crimson: '#dc143c',
  coral: '#ff7f50',
  salmon: '#fa8072',
  khaki: '#f0e68c',
  turquoise: '#40e0d0',
  tan: '#d2b48c',
  transparent: '#00000000',
};

const clampByte = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

function parse(input: string): RGBA {
  let s = input.trim().toLowerCase();
  if (s in NAMED) s = NAMED[s]!;

  const hex = /^#?([0-9a-f]{3,8})$/i.exec(s);
  if (hex) {
    let h = hex[1]!;
    if (h.length === 3 || h.length === 4)
      h = h
        .split('')
        .map((c) => c + c)
        .join('');
    if (h.length !== 6 && h.length !== 8) throw new ToolError('Invalid hex length.');
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
  }

  const nums = (str: string) =>
    str
      .replace(/[^\d.,%/\- ]/g, ' ')
      .split(/[\s,/]+/)
      .filter(Boolean);

  const rgb = /^rgba?\((.+)\)$/.exec(s);
  if (rgb) {
    const p = nums(rgb[1]!);
    if (p.length < 3) throw new ToolError('rgb() needs three components.');
    const toByte = (v: string) => (v.endsWith('%') ? (parseFloat(v) / 100) * 255 : parseFloat(v));
    return {
      r: clampByte(toByte(p[0]!)),
      g: clampByte(toByte(p[1]!)),
      b: clampByte(toByte(p[2]!)),
      a: p[3] != null ? parseAlpha(p[3]!) : 1,
    };
  }

  const hsl = /^hsla?\((.+)\)$/.exec(s);
  if (hsl) {
    const p = nums(hsl[1]!);
    if (p.length < 3) throw new ToolError('hsl() needs three components.');
    const { r, g, b } = hslToRgb(
      parseFloat(p[0]!),
      parseFloat(p[1]!) / 100,
      parseFloat(p[2]!) / 100,
    );
    return { r, g, b, a: p[3] != null ? parseAlpha(p[3]!) : 1 };
  }

  throw new ToolError(`Could not parse "${input}".`, 'Try #hex, rgb(), hsl() or a colour name.');
}

function parseAlpha(v: string): number {
  return v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v);
}

function hslToRgb(h: number, s: number, l: number) {
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

function rgbToHsl({ r, g, b }: RGBA) {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0,
    s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function rgbToHsv({ r, g, b }: RGBA) {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  return { h, s: Math.round((max === 0 ? 0 : d / max) * 100), v: Math.round(max * 100) };
}

function rgbToCmyk({ r, g, b }: RGBA) {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round(((1 - rn - k) / (1 - k)) * 100),
    m: Math.round(((1 - gn - k) / (1 - k)) * 100),
    y: Math.round(((1 - bn - k) / (1 - k)) * 100),
    k: Math.round(k * 100),
  };
}

function srgbToLinear(c: number) {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

function relLuminance({ r, g, b }: RGBA) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrast(a: RGBA, b: RGBA) {
  const l1 = relLuminance(a),
    l2 = relLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function rgbToOklch({ r, g, b }: RGBA) {
  const lr = srgbToLinear(r),
    lg = srgbToLinear(g),
    lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.sqrt(A * A + B * B);
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { l: L, c: C, h: H };
}

const hex2 = (n: number) => n.toString(16).padStart(2, '0');

function run(input: TextRunInput): TextRunResult {
  if (!input.text.trim()) return { output: '' };
  const rgba = parse(input.text);
  const { r, g, b, a } = rgba;
  const hasAlpha = a < 1;

  const hsl = rgbToHsl(rgba);
  const hsv = rgbToHsv(rgba);
  const cmyk = rgbToCmyk(rgba);
  const ok = rgbToOklch(rgba);

  const hex = `#${hex2(r)}${hex2(g)}${hex2(b)}${hasAlpha ? hex2(clampByte(a * 255)) : ''}`;
  const lines = [
    `HEX    ${hex}`,
    `RGB    ${hasAlpha ? `rgb(${r} ${g} ${b} / ${a.toFixed(3)})` : `rgb(${r} ${g} ${b})`}`,
    `HSL    hsl(${hsl.h} ${hsl.s}% ${hsl.l}%${hasAlpha ? ` / ${a.toFixed(3)}` : ''})`,
    `HSV    hsv(${hsv.h} ${hsv.s}% ${hsv.v}%)`,
    `CMYK   cmyk(${cmyk.c}% ${cmyk.m}% ${cmyk.y}% ${cmyk.k}%)`,
    `OKLCH  oklch(${ok.l.toFixed(3)} ${ok.c.toFixed(3)} ${ok.h.toFixed(1)})`,
  ];

  const white: RGBA = { r: 255, g: 255, b: 255, a: 1 };
  const black: RGBA = { r: 0, g: 0, b: 0, a: 1 };
  const cw = contrast(rgba, white);
  const cb = contrast(rgba, black);

  return {
    output: lines.join('\n'),
    render: 'code',
    stats: {
      'vs white': `${cw.toFixed(2)}:1 ${cw >= 4.5 ? 'AA' : ''}`,
      'vs black': `${cb.toFixed(2)}:1 ${cb >= 4.5 ? 'AA' : ''}`,
      luminance: relLuminance(rgba).toFixed(4),
    },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
