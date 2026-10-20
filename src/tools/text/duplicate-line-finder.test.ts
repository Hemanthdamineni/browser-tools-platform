import { describe, expect, it } from 'vitest';
import tool from './duplicate-line-finder.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;
const rows = (r: Result): string[][] => (JSON.parse(r.output) as { headers: string[]; rows: string[][] }).rows;

describe('duplicate-line-finder', () => {
  it('reports duplicates with counts and first line numbers', async () => {
    const r = await run('apple\nbanana\napple\ncherry\nbanana\napple');
    const rws = rows(r);
    expect(rws.find((row) => row[0] === 'apple')).toBeDefined();
    expect(rws.find((row) => row[0] === 'apple')![1]).toBe('3');
    expect(rws.find((row) => row[0] === 'apple')![2]).toBe('1');
    expect(r.stats?.extra).toBe(3);
  });

  it('does not list unique lines by default', async () => {
    const r = await run('a\nb\na');
    expect(rows(r).some((row) => row[0] === 'b')).toBe(false);
    expect(r.stats?.duplicates).toBe(1);
  });

  it('can include unique lines and sort by frequency', async () => {
    const r = await run('a\nb\na', { includeUnique: true, sortBy: 'frequency' });
    const rws = rows(r);
    expect(rws[0]![0]).toBe('a');
    expect(rws).toHaveLength(2);
  });

  it('handles case-insensitive and trimmable matching', async () => {
    const ci = await run('A\n a \nA\nb', { ignoreCase: true, trim: true });
    const rws = rows(ci);
    const a = rws.find((row) => row[0] === 'A')!;
    expect(a[1]).toBe('3');
    expect(ci.stats?.extra).toBe(2);
  });

  it('reports a clean pass for unique input', async () => {
    const r = await run('x\ny\nz');
    expect(rows(r)[0]![0]).toBe('—');
    expect((r.notes ?? []).join(' ')).toMatch(/[Nn]o duplicates/);
  });

  it('rejects empty input', async () => {
    await expect(run('   ')).rejects.toThrow(/paste a list/i);
  });
});
