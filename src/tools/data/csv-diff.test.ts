import { describe, expect, it } from 'vitest';
import tool from './csv-diff.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };
type Table = { headers: string[]; rows: string[][] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;
const table = (r: Result): Table => JSON.parse(r.output) as Table;
const statuses = (r: Result) => table(r).rows.map((x) => x[0]);

const a3 = 'id,name,city\n1,Alice,Berlin\n2,Bob,Paris\n3,Delia,Rome\n4,Eve,Oslo';
const b3 = 'id,name,city\n2,Bob,Lyon\n4,Eve,Oslo';

describe('csv-diff', () => {
  it('reports changed, removed, added and unchanged', async () => {
    const r = await run(a3, { second: b3, keyColumn: 'id' });
    const t = table(r);
    expect(t.headers).toEqual(['Status', 'Key', 'Column', 'A', 'B']);
    expect(
      t.rows.find(
        (x) => x[0] === 'changed' && x[2] === 'city' && x[3] === 'Paris' && x[4] === 'Lyon',
      ),
    ).toBeDefined();
    expect(t.rows.find((x) => x[0] === 'removed')).toBeDefined();
    expect(r.stats).toEqual({ added: 0, removed: 2, changed: 1, unchanged: 1, rowsA: 4, rowsB: 2 });
  });

  it('treats four identical rows as unchanged', async () => {
    const r = await run(a3, { second: a3 });
    expect(statuses(r)).toEqual([]);
    expect(r.stats?.unchanged).toBe(4);
  });

  it('detects an added row', async () => {
    const r = await run('id,name\n1,Alice\n2,Bob', { second: 'id,name\n1,Alice\n2,Bob\n3,Cara' });
    expect(table(r).rows.find((x) => x[0] === 'added')![1]).toBe('3');
  });

  it('detects a removed row', async () => {
    const r = await run('id,name\n1,Alice\n2,Bob\n3,Cara', { second: 'id,name\n1,Alice\n2,Bob' });
    expect(table(r).rows.find((x) => x[0] === 'removed')![1]).toBe('3');
  });

  it('matches rows even when order differs', async () => {
    const r = await run('id,name\n1,Alice\n2,Bob', { second: 'id,name\n2,Bob\n1,Alice' });
    expect(statuses(r)).toEqual([]);
  });

  it('supports custom key column', async () => {
    const r = await run('sku,name\nA1,x', { second: 'sku,name\nA1,x\nA2,y', keyColumn: 'sku' });
    expect(table(r).rows.find((x) => x[0] === 'added')![1]).toBe('A2');
  });

  it('reports column differences', async () => {
    const r = await run('id,name,city\n1,Alice,Berlin', { second: 'id,name,country\n1,Alice,DE' });
    const note = (r.notes ?? []).join(' ');
    expect(note).toMatch(/only in A/);
    expect(note).toMatch(/only in B/);
  });

  it('handles quoted CSV with embedded comma and newline', async () => {
    const r = await run('id,note\n1,"hello, world"' as string, {
      second: 'id,note\n1,"hello, world!"' as string,
    });
    const row = table(r).rows.find((x) => x[0] === 'changed')!;
    expect(row[3]).toBe('hello, world');
    expect(row[4]).toBe('hello, world!');
  });

  it('detects duplicate keys', async () => {
    const r = await run('id,name\n1,x\n1,y', { second: 'id,name\n1,z' });
    expect((r.notes ?? []).join(' ')).toMatch(/Duplicate keys/);
  });

  it('supports semicolon delimiters', async () => {
    const r = await run('id;name\n1;A', { second: 'id;name\n1;B', delimiter: 'auto' });
    expect(table(r).rows.find((x) => x[0] === 'changed')![3]).toBe('A');
  });

  it('errors on missing key column', async () => {
    await expect(run('a,b\n1,2', { second: 'a,c\n1,2', keyColumn: 'b' })).rejects.toThrow(
      /missing from CSV B/,
    );
  });

  it('errors when inputs are blank', async () => {
    await expect(run('', { second: b3 })).rejects.toThrow(/first CSV/);
    await expect(run(a3, { second: '' })).rejects.toThrow(/second CSV/);
  });
});
