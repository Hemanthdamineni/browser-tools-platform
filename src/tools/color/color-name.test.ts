import { describe, it, expect } from 'vitest';
import tool from './color-name.tool';
import { ToolError, type TextRunResult } from '@/lib/types';
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as TextRunResult;
const table = (r: TextRunResult) => JSON.parse(r.output) as { rows: string[][] };

describe('color-name', () => {
  it('#ff0000 is exactly red at distance 0', () => {
    const r = run('#ff0000');
    expect(table(r).rows[0]).toEqual(['red', '#ff0000', '0.0']);
    expect(r.stats!['exact match']).toBe('yes');
  });

  it('#ee0000 is still nearest to red', () => {
    expect(table(run('#ee0000')).rows[0]![0]).toBe('red');
    expect(run('#ee0000').stats!['exact match']).toBe('no');
  });

  it('#7fffd4 is exactly aquamarine', () => {
    const r = run('#7fffd4');
    expect(table(r).rows[0]).toEqual(['aquamarine', '#7fffd4', '0.0']);
  });

  it('returns five rows, closest first', () => {
    const rows = table(run('rgb(100, 149, 237)')).rows;
    expect(rows).toHaveLength(5);
    const ds = rows.map((x) => parseFloat(x[2]!));
    expect([...ds].sort((a, b) => a - b)).toEqual(ds);
    expect(parseFloat(rows[0]![2]!)).toBeLessThan(parseFloat(rows[4]![2]!));
  });

  it('accepts named and hsl() input', () => {
    expect(table(run('cornflowerblue')).rows[0]).toEqual(['cornflowerblue', '#6495ed', '0.0']);
    expect(table(run('hsl(0, 100%, 50%)')).rows[0]![0]).toBe('red');
  });

  it('empty input gives empty output', () => {
    expect(run('').output).toBe('');
  });

  it('throws ToolError on a bad colour', () => {
    expect(() => run('not-a-colour')).toThrow(ToolError);
    expect(() => run('not-a-colour')).toThrow(/is not a colour/);
  });
});
