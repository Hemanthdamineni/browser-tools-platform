import { describe, expect, it } from 'vitest';
import tool from './csv-profiler.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };
type Table = { headers: string[]; rows: string[][] };

const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

const table = (r: Result): Table => JSON.parse(r.output) as Table;

describe('csv-profiler', () => {
  it('infers column types and counts', async () => {
    const r = await run('a,b,c\n1,true,x\n2,false,y\n3,true,z', { parseNumbers: false });
    const t = table(r);
    expect(t.headers).toEqual(['Type', 'Rows', 'Missing', 'Unique']);
    const a = t.rows.find((x) => x[0] === 'a')!;
    const b = t.rows.find((x) => x[0] === 'b')!;
    const c = t.rows.find((x) => x[0] === 'c')!;
    expect(a[1]).toBe('integer');
    expect(b[1]).toBe('boolean');
    expect(c[1]).toBe('string');
    expect(a[2]).toBe('3');
    expect(a[3]).toBe('0');
    expect(a[4]).toBe('3');
  });

  it('detects number, missing values and unique counts', async () => {
    const r = await run('val\n1.5\n \n2\n');
    const t = table(r);
    const col = t.rows.find((x) => x[0] === 'val')!;
    expect(col[1]).toBe('number');
    expect(col[2]).toBe('3');
    expect(col[3]).toBe('1');
    expect(col[4]).toBe('2');

    const n = await run('n\n1\n2.5\n3\n');
    const nt = table(n);
    const nc = nt.rows.find((x) => x[0] === 'n')!;
    expect(nc).toContain('1');
    expect(nc).toContain('3');
    expect(nc).toContain('2.17');
  });

  it('supports non-comma delimiters', async () => {
    const r = await run('a\tb\tc\n1\ttrue\tx\n2\tfalse\ty', { delimiter: 'tab' });
    const t = table(r);
    expect(t.rows.find((x) => x[0] === 'a')![1]).toBe('integer');
    expect(t.rows.find((x) => x[0] === 'b')![1]).toBe('boolean');
  });

  it('toggles numeric stats', async () => {
    const on = await run('v\n1\n2\n3');
    const t = table(on);
    expect(t.headers).toContain('Mean');
    const off = await run('v\n1\n2\n3', { parseNumbers: false });
    const to = table(off);
    expect(to.headers).not.toContain('Mean');
  });

  it('treats true/false-only columns as boolean and 01 as integer', async () => {
    const r = await run('a,b\nTRUE,01\nFALSE,007');
    const t = table(r);
    expect(t.rows.find((x) => x[0] === 'a')![1]).toBe('boolean');
    expect(t.rows.find((x) => x[0] === 'b')![1]).toBe('integer');
  });

  it('quoted fields with delimiters parse correctly', async () => {
    const r = await run('a,b\n"x, y",2\n"z",3');
    const t = table(r);
    const a = t.rows.find((x) => x[0] === 'a')!;
    const b = t.rows.find((x) => x[0] === 'b')!;
    expect(a[2]).toBe('2');
    expect(b[1]).toBe('integer');
  });

  it('adds missing headers as Column N', async () => {
    const r = await run('a\n1,2');
    const t = table(r);
    expect(t.rows[0]?.[0]).toBe('a');
    expect(t.rows[1]?.[0]).toBe('Column 2');
  });

  it('errors on blank input and header-only data', async () => {
    await expect(run('   ')).rejects.toThrow(/paste a csv/i);
    await expect(run('a,b\n')).rejects.toThrow(/at least a header/i);
  });

  it('reports stats', async () => {
    const r = await run('a,b\n1,x\n2,y');
    expect(r.stats?.columns).toBe(2);
    expect(r.stats?.rows).toBe(2);
  });
});
