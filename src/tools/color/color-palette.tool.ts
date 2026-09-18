import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './color-palette.meta';

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface HSL {
  h: number;
  s: number;
  l: number;
}

const NAMED: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000',
  blue: '#0000ff', lime: '#00ff00', navy: '#000080', teal: '#008080',
  aqua: '#00ffff', cyan: '#00ffff', magenta: '#ff00ff', fuchsia: '#ff00ff',
  yellow: '#ffff00', orange: '#ffa500', purple: '#800080', gray: '#808080',
  grey: '#808080', silver: '#c0c0c0', maroon: '#800000', olive: '#808000',
  pink: '#ffc0cb', gold: '#ffd700', indigo: '#4b0082', violet: '#ee82ee',
  crimson: '#dc143c', coral: '#ff7f50', salmon: '#fa8072', khaki: '#f0e68c',
  turquoise: '#40e0d0', tan: '#d2b48c',
};

function parseRGB(input: string): RGB {
  let s = input.trim().toLowerCase();
  if (s in NAMED) s = NAMED[s]!;

  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    let h = hex[1]!;
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  const rgb = /^rgba?\((.+)\)$/.exec(s);
  if (rgb) {
    const parts = rgb[1]!
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map((v) => (v.endsWith('%') ? (parseFloat(v) / 100) * 255 : parseFloat(v)));
    if (parts.length < 3 || parts.slice(0, 3).some((v) => !Number.isFinite(v))) {
      throw new ToolError(`"${input.trim()}" is not a colour.`);
    }
    return {
      r: Math.max(0, Math.min(255, Math.round(parts[0]!))),
      g: Math.max(0, Math.min(255, Math.round(parts[1]!))),
      b: Math.max(0, Math.min(255, Math.round(parts[2]!))),
    };
  }

  throw new ToolError(`"${input.trim()}" is not a colour.`);
}

function rgbToHsl(c: RGB): HSL {
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h: ((h % 360) + 360) % 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const hh = ((h % 360) + 360) % 360 / 360;
  const ss = s / 100;
  const ll = l / 100;
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const t = (x: number) => {
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return {
    r: clamp(t(hh + 1 / 3) * 255),
    g: clamp(t(hh) * 255),
    b: clamp(t(hh - 1 / 3) * 255),
  };
}

const hex = (c: RGB) =>
  '#' +
  [c.r,c.g,c.b].map((v) => v.toString(16).padStart(2, '0')).join('');

type Scheme = 'tints-shades' | 'monochromatic' | 'complementary' | 'analogous' | 'triadic' | 'tetradic' | 'split-complementary';

function palettes(base: RGB, scheme: Scheme, count: number): RGB[] {
  const { h,s,l } = rgbToHsl(base);
  const steps = Math.max(3, Math.min(12, count || 7));
  const range = (a: number, b: number, n: number) =>
    Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
  const build = (entries: { h: number;s: number;l: number }[]): RGB[] =>
    entries.map((e) => hslToRgb(e.h,e.s,e.l));

  switch (scheme) {
    case 'tints-shades':
      return build(range(10, 95, steps).map((lv) => ({ h,s,l: lv })));
    case 'monochromatic':
      return build(range(0, steps - 1, steps).map((i) => ({
        h,
        s: Math.max(5, Math.min(95, s + (i - (steps -  1) / 2) * 10)),
        l: Math.max(10, Math.min(90, l + (i - (steps -  1) / 2) * 10)),
      })));
    case 'complementary':
      return build([{ h,s,l},{ h: h + 180,s,l}]);
    case 'analogous':
      return build(range(-30, 30, steps).map((dh) => ({ h: (((h + dh) % 360) + 360) % 360,s,l })));
    case 'triadic':
      return build([0, 120, 240].map((dh) => ({ h: (h + dh) % 360,s,l })));
    case 'tetradic':
      return build([0, 90, 180, 270].map((dh) => ({ h: (h + dh) % 360,s,l })));
    case 'split-complementary':
      return build([0, 150, 210].map((dh) => ({ h: (h + dh) % 360,s,l })));
  }
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta,input.options);
  if (!input.text.trim()) return { output: '' };
  const base = parseRGB(input.text);
  const scheme = String(o.scheme) as Scheme;
  const count = Number(o.count);
  const palette = palettes(base,scheme,count);
  return {
    output: JSON.stringify(palette.map((c) => hex(c))),
    render: 'colors',
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
