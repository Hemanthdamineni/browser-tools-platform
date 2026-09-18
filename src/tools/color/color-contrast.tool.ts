import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './color-contrast.meta';

interface RGB {
  r: number;
  g: number;
  b: number;
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

function parse(input: string): RGB {
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

const SRGB = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

const luminance = (c: RGB) =>
  0.2126 * SRGB(c.r) + 0.7152 * SRGB(c.g) + 0.0722 * SRGB(c.b);

function apcaLc(fg: RGB, bg: RGB): number {
  // APCA 0.0.98G "approx": linearise, scale, then subtract the perceived lightness.
  const fl = (c: RGB) => {
    const lin = (v: number) => Math.pow(v / 255, 2.4);
    return lin(c.r) * 0.2126729 + lin(c.g) * 0.7151522 + lin(c.b) * 0.072175;
  };
  const ybg = fl(bg);
  const yfg = fl(fg);
  const contrast = (Math.abs(ybg - yfg) + 0.027) / (Math.max(ybg,yfg) + 0.027);
  const lc = Math.sign(yfg - ybg) * (contrast * 104 - 1.8);
  return Math.round(lc * 10) / 10;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const fgText = input.text.trim();
  if (!fgText) return { output: '' };
  const fg = parse(fgText);
  const bg = parse(String(o.second));
  const L1 = luminance(fg);
  const L2 = luminance(bg);
  const [hi, lo] = L1 >= L2 ? [L1,L2] : [L2,L1];
  const ratio = (hi + 0.05) / (lo + 0.05);
  const ratioStr = ratio.toFixed(2);

  const pass = (min: number) => (ratio >= min ? 'Pass' : 'Fail');
  const rows: string[][] = [
    ['Contrast ratio', `${ratioStr}:1`],
    ['AA normal text (>=4.5)', pass(4.5)],
    ['AA large text (>=3)', pass(3)],
    ['AAA normal (>=7)', pass(7)],
    ['AAA large (>=4.5)', pass(4.5)],
    ['Graphics/UI (>=3)', pass(3)],
    ['APCA Lc (approx)', `${apcaLc(fg, bg)}`],
  ];

  return {
    output: JSON.stringify({ headers: ['Check', 'Result'], rows }),
    render: 'table',
    stats: { ratio: `${ratioStr}:1` },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
