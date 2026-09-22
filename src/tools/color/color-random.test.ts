import { describe, it, expect } from 'vitest';
import tool from './color-random.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string };
const colors = (r: { output: string }) => JSON.parse(r.output) as string[];

const HEX = /^#[0-9a-f]{6}$/;
const RGB = /^rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)$/;
const HSL = /^hsl\(\d{1,3}, \d{1,3}%, \d{1,3}%\)$/;

describe('color-random', () => {
  it('is a generator: empty input still produces the default 8 colours as hex', () => {
    const c = colors(run(''));
    expect(c).toHaveLength(8);
    expect(c.every((x) => HEX.test(x))).toBe(true);
  });

  it('respects count within the 1..48 clamp', () => {
    expect(colors(run('', { count: 12 }))).toHaveLength(12);
    expect(colors(run('', { count: 1 }))).toHaveLength(1);
    expect(colors(run('', { count: 999 }))).toHaveLength(48);
  });

  it('formats as rgb() and hsl()', () => {
    expect(colors(run('', { format: 'rgb', count: 5 })).every((x) => RGB.test(x))).toBe(true);
    expect(colors(run('', { format: 'hsl', count: 5 })).every((x) => HSL.test(x))).toBe(true);
  });

  it('grayscale colours have R == G == B', () => {
    const c = colors(run('', { style: 'grayscale', count: 20 }));
    for (const hex of c) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      expect(r).toBe(g);
      expect(g).toBe(b);
    }
  });

  it('pastel colours are light and desaturated', () => {
    const c = colors(run('', { style: 'pastel', count: 20 }));
    for (const hex of c) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      expect(r).toBeGreaterThan(150);
      expect(g).toBeGreaterThan(150);
      expect(b).toBeGreaterThan(150);
    }
  });

  it('warm colours stay in the warm hue ranges', () => {
    const c = colors(run('', { style: 'warm', count: 24 }));
    for (const hex of c) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      // warm hues (0-60 or 300-360 at S>=0.55) always have r >= b
      expect(r).toBeGreaterThanOrEqual(b);
      expect(g).toBeLessThanOrEqual(r);
    }
  });

  it('colour colours differ across runs (cryptographic randomness)', () => {
    const a = colors(run('', { count: 8 }));
    const b = colors(run('', { count: 8 }));
    expect(a.some((x, i) => x !== b[i])).toBe(true);
  });
});
