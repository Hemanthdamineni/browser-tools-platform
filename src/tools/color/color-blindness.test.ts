import { describe, it, expect } from 'vitest';
import tool from './color-blindness.tool';
import { ToolError, type TextRunResult } from '@/lib/types';
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as TextRunResult;
const colors = (r: TextRunResult) => JSON.parse(r.output) as string[];
const chan = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);

describe('color-blindness', () => {
  it('pure red under deuteranopia at 100% shifts to a yellow-brown with raised G', () => {
    const c = colors(run('#ff0000'));
    const out = c[0]!;
    expect(out).not.toBe('#ff0000');
    expect(chan(out, 1)).toBeGreaterThan(chan('#ff0000', 1)); // G rose
    expect(chan(out, 2)).toBe(0); // still no blue
  });

  it('severity 0 leaves every colour unchanged', () => {
    const c = colors(run('#ff0000\n#00ff00\n#0000ff', { severity: 0 }));
    expect(c).toEqual(['#ff0000', '#00ff00', '#0000ff']);
  });

  it('achromatopsia produces a perfect grey', () => {
    const c = colors(run('#3b82f6', { type: 'achromatopsia' }));
    const out = c[0]!;
    expect(chan(out, 0)).toBe(chan(out, 1));
    expect(chan(out, 1)).toBe(chan(out, 2));
  });

  it('simulates one colour per line and keeps the originals in a note', () => {
    const r = run('#ff0000\n#00ff00');
    expect(colors(r)).toHaveLength(2);
    expect(r.notes![0]).toContain('#ff0000');
    expect(r.notes![0]).toContain('#00ff00');
  });

  it('accepts rgb() and named colours', () => {
    const c = colors(run('rgb(255, 0, 0)\ntomato'));
    expect(c).toHaveLength(2);
    expect(c.every((x) => /^#[0-9a-f]{6}$/.test(x))).toBe(true);
  });

  it('empty input gives empty output', () => {
    expect(run('').output).toBe('');
  });

  it('throws ToolError when no line parses', () => {
    expect(() => run('hello')).toThrow(ToolError);
    expect(() => run('hello')).toThrow(/is not a colour/);
  });
});
