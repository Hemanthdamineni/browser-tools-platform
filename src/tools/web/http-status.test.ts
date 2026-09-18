import { describe, it, expect } from 'vitest';
import tool from './http-status.tool';

type Result = { output: string; notes?: string[]; render?: string };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  await tool.run({ text, options }) as Result;

const rows = (r: Result) => (JSON.parse(r.output) as { rows: string[][] }).rows;

describe('http-status', async () => {
  it('404 resolves to Not Found', async () => {
    const r = rows(await run('404'));
    expect(r[0]![0]).toBe('404');
    expect(r[0]![1]).toBe('Not Found');
  });

  it('keyword search finds the teapot', async () => {
    const r = rows(await run('teapot'));
    expect(r[0]![0]).toBe('418');
  });

  it('429 and 451 are present in the full list', async () => {
    const all = rows(await run(''));
    expect(all.some((r) => r[0] === '429')).toBe(true);
    expect(all.some((r) => r[0] === '451')).toBe(true);
  });

  it('category 5xx filters the full list to server errors', async () => {
    const r = rows(await run('', { category: '5xx' }));
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((row) => row[0]!.startsWith('5'))).toBe(true);
  });

  it('keyword search matches meanings too', async () => {
    const r = rows(await run('rate limit'));
    expect(r.some((row) => row[0] === '429')).toBe(true);
  });

  it('unknown code returns an empty table with a note', async () => {
    const r = await run('999');
    expect(rows(r)).toEqual([]);
    expect(r.notes?.[0]).toMatch(/not in the standard registry/);
  });

  it('empty input lists everything (60+ codes)', async () => {
    expect(rows(await run('')).length).toBeGreaterThan(60);
  });
});