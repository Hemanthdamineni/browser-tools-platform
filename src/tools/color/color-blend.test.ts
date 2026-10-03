import { describe, it, expect } from 'vitest';
import tool from './color-blend.tool';
import { ToolError, type TextRunResult } from '@/lib/types';
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as TextRunResult;
const colors = (r: TextRunResult) => JSON.parse(r.output) as string[];

describe('color-blend', () => {
  it('black + white at 50% in RGB is exactly #808080', () => {
    const r = run('#000000', { second: '#ffffff', ratio: 50, space: 'rgb' });
    expect(colors(r)[1]).toBe('#808080');
    expect(colors(r)).toEqual(['#000000', '#808080', '#ffffff']);
    expect(r.stats!.blended).toContain('#808080');
    expect(r.stats!.blended).toContain('rgb(128, 128, 128)');
  });

  it('ratio 0 returns the first color, ratio 100 the second', () => {
    expect(colors(run('#ff0000', { second: '#00ff00', ratio: 0 }))[1]).toBe('#ff0000');
    expect(colors(run('#ff0000', { second: '#00ff00', ratio: 100 }))[1]).toBe('#00ff00');
  });

  it('blends named colours and rgb() input', () => {
    const c = colors(run('red', { second: 'rgb(0, 0, 255)', ratio: 50, space: 'rgb' }));
    expect(c[0]).toBe('#ff0000');
    expect(c[1]).toBe('#800080');
    expect(c[2]).toBe('#0000ff');
  });

  it('HSL blending follows the shorter hue arc', () => {
    // red h=0 to blue h=240: shorter arc goes via 300 (magenta), not 120 (green).
    const c = colors(run('red', { second: 'blue', ratio: 50, space: 'hsl' }));
    expect(c[1]).toBe('#ff00ff');
  });

  it('HSL blend of a grey stays grey', () => {
    const c = colors(run('#808080', { second: '#404040', ratio: 50, space: 'hsl' }));
    expect(c[1]).toBe('#606060');
  });

  it('empty input gives empty output', () => {
    expect(run('').output).toBe('');
  });

  it('throws ToolError on a bad colour', () => {
    expect(() => run('#zzzzzz')).toThrow(ToolError);
    expect(() => run('#000000', { second: 'not-a-colour' })).toThrow(/is not a colour/);
  });
});
