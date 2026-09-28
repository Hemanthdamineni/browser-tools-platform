import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './color-random.meta';

/* Cryptographically random colours constrained by HSL "style" ranges. */

interface HSL {
  h: number;
  s: number;
  l: number;
}

function rand(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! / 2 ** 32;
}

function pickHue(warm: boolean): number {
  if (!warm) return rand() * 360;
  return rand() < 0.5 ? rand() * 60 : 300 + rand() * 60;
}

function styleHsl(style: string): HSL {
  switch (style) {
    case 'warm':
      return { h: pickHue(true), s: 0.55 + rand() * 0.35, l: 0.4 + rand() * 0.25 };
    case 'cool':
      return { h: 180 + rand() * 120, s: 0.55 + rand() * 0.35, l: 0.4 + rand() * 0.25 };
    case 'pastel':
      return { h: rand() * 360, s: 0.25 + rand() * 0.2, l: 0.8 + rand() * 0.12 };
    case 'vivid':
      return { h: rand() * 360, s: 0.8 + rand() * 0.2, l: 0.45 + rand() * 0.15 };
    case 'grayscale':
      return { h: 0, s: 0, l: rand() };
    case 'earth':
      return { h: 20 + rand() * 25, s: 0.3 + rand() * 0.3, l: 0.25 + rand() * 0.3 };
    default:
      return { h: rand() * 360, s: rand(), l: rand() };
  }
}

function hslToRgb({ h, s, l }: HSL): [number, number, number] {
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
  return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
}

function format(hsl: HSL, format: string): string {
  const [r, g, b] = hslToRgb(hsl);
  if (format === 'rgb') return `rgb(${r}, ${g}, ${b})`;
  if (format === 'hsl')
    return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%)`;
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const count = Math.max(1, Math.min(48, Math.floor(Number(o.count) || 8)));
  const fmt = String(o.format);
  const style = String(o.style);

  const colors: string[] = [];
  for (let i = 0; i < count; i++) colors.push(format(styleHsl(style), fmt));

  return {
    output: JSON.stringify(colors),
    render: 'colors',
    stats: { count, style, format: fmt },
    notes: ['Colours come from the browser cryptographic random number generator.'],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
