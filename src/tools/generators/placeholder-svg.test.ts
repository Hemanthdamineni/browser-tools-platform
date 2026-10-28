import { describe, it, expect } from 'vitest';
import tool from './placeholder-svg.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  (tool.run({ text, options }) as { output: string }).output;

const decode = (uri: string) => decodeURIComponent(escape(atob(uri.split(',')[1]!)));

describe('placeholder-svg', () => {
  it('defaults produce a 600×400 image labelled 600×400', () => {
    const out = run('');
    expect(out.startsWith('data:image/svg+xml;base64,')).toBe(true);
    const svg = decode(out);
    expect(svg).toContain('width="600"');
    expect(svg).toContain('>600×400<');
  });

  it('custom label appears escaped in the text node', () => {
    expect(decode(run('', { label: 'Hero' }))).toContain('>Hero<');
    expect(decode(run('', { label: 'A<B' }))).toContain('&lt;');
  });

  it('empty label falls back to WxH; set label wins', () => {
    expect(decode(run('', { width: 100, height: 50 }))).toContain('>100×50<');
  });

  it('out-of-range size throws', () => {
    expect(() => run('', { width: 8 })).toThrow(/at least 16/);
    expect(() => run('', { height: 5000 })).not.toThrow();
  });

  it('invalid colours throw', () => {
    expect(() => run('', { bg: 'silver' })).toThrow(/hex colour/);
  });

  it('auto font size scales with the smaller dimension', () => {
    const svg = decode(run('', { width: 600, height: 400 }));
    expect(svg).toContain('font-size="67"');
  });
});
