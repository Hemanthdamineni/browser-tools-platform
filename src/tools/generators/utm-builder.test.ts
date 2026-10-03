import { describe, it, expect } from 'vitest';
import tool from './utm-builder.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as { output: string; warnings?: string[] };

describe('utm-builder', () => {
  it('builds the canonical URL for source/medium/campaign', () => {
    const out = run('https://ex.com/p', {
      source: 'newsletter',
      medium: 'email',
      campaign: 'spring',
    });
    expect(out.output.split('\n')[0]).toBe(
      'https://ex.com/p?utm_source=newsletter&utm_medium=email&utm_campaign=spring',
    );
  });

  it('lowercase=true lowercases values', () => {
    const out = run('https://ex.com', { campaign: 'Spring_Sale', lowercase: true });
    expect(out.output).toContain('utm_campaign=spring_sale');
  });

  it('stripExisting replaces an old utm_source', () => {
    const out = run('https://ex.com?utm_source=old', { source: 'new', stripExisting: true });
    expect(out.output).toContain('utm_source=new');
    expect(out.output).not.toContain('utm_source=old');
  });

  it('stripExisting=false keeps the old parameter', () => {
    const out = run('https://ex.com?utm_source=old', { source: 'new', stripExisting: false });
    expect(out.output).toContain('utm_source=old');
    expect(out.output).toContain('utm_source=new');
  });

  it('warns when source/medium/campaign are missing', () => {
    const out = run('https://ex.com', { term: 'shoes' });
    expect(out.warnings?.[0]).toMatch(/utm_source/);
  });

  it('no warnings when all three are set', () => {
    const out = run('https://ex.com', { source: 'a', medium: 'b', campaign: 'c' });
    expect(out.warnings).toBeUndefined();
  });

  it('invalid URL throws', () => {
    expect(() => run('not a url', { source: 'x' })).toThrow(/valid URL/);
  });

  it('empty input returns empty output', () => {
    expect(run('', { source: 'x' }).output).toBe('');
  });
});
