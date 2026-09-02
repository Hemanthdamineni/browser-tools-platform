import { describe, it, expect } from 'vitest';
import tool from './color-convert.tool';

const conv = (text: string) =>
  tool.run({ text, options: {} }) as { output: string; stats?: Record<string, string> };

describe('color-convert', () => {
  it('parses #rrggbb and reports all formats', () => {
    const { output } = conv('#3b82f6');
    expect(output).toContain('HEX    #3b82f6');
    expect(output).toContain('RGB    rgb(59 130 246)');
    expect(output).toMatch(/HSL {4}hsl\(217 91% 60%\)/);
    expect(output).toContain('OKLCH');
  });

  it('parses short hex', () => {
    expect(conv('#f00').output).toContain('rgb(255 0 0)');
  });

  it('parses rgb() with spaces and commas', () => {
    expect(conv('rgb(239, 68, 68)').output).toContain('HEX    #ef4444');
    expect(conv('rgb(239 68 68)').output).toContain('HEX    #ef4444');
  });

  it('parses hsl()', () => {
    // hsl(160 84% 39%) -> rgb(16 183 127)
    expect(conv('hsl(160 84% 39%)').output).toContain('#10b77f');
  });

  it('parses named colours', () => {
    expect(conv('teal').output).toContain('#008080');
    expect(conv('white').output).toContain('#ffffff');
  });

  it('keeps alpha through hex8', () => {
    expect(conv('#00000080').output).toMatch(/RGB {4}rgb\(0 0 0 \/ 0\.50/);
  });

  it('computes contrast ratios', () => {
    const { stats } = conv('#ffffff');
    expect(stats!['vs black']).toMatch(/21\.00:1/);
  });

  it('throws on gibberish', () => {
    expect(() => conv('not-a-color')).toThrow();
  });

  it('empty input yields empty output', () => {
    expect(conv('').output).toBe('');
  });
});
