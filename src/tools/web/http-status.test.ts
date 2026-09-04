import { describe, it, expect } from 'vitest';
import tool from './http-status.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options });
const rows = (r: ReturnType<typeof run>) => (JSON.parse(r.output) as { rows: string[][] }).rows;

describe('http-status', () => {
  it('404 resolves to Not Found', () => {
    const r = rows(run('404'));
    expect(r[0]![0]).toBe('404');
    expect(r[0]![1]).toBe('Not Found');
  });

  it('keyword search finds the teapot', () => {
    const r = rows(run('teapot'));
    expect(r[0]![0]).toBe('418');
  });

  it('429 and 451 are present in the full list', () => {
    const all = rows(run(''));
    expect(all.some((r) => r[0] === '429')).toBe(true);
    expect(all.some((r) => r[0] === '451')).toBe(true);
  });

  it('category 5xx filters the full list to server errors', () => {
    const r = rows(run('', { category: '5xx' }));
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((row) => row[0]!.startsWith('5'))).toBe(true);
  });

  it('keyword search matches meanings too', () => {
    const r = rows(run('rate limit'));
    expect(r.some((row) => row[0] === '429')).toBe(true);
  });

  it('unknown code returns an empty table with a note', () => {
    const r = run('999');
    expect(rows(r)).toEqual([]);
    expect(r.notes?.[0]).toMatch(/not in the standard registry/);
  });

  it('empty input lists everything (60+ codes)', () => {
    expect(rows(run()).length).toBeGreaterThan(60);
  });
});
