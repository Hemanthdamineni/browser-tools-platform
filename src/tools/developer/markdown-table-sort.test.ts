import { describe, expect, it } from 'vitest';
import tool from './markdown-table-sort.tool';

type Result = { output: string; render?: string; stats?: Record<string, number> };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

const T = '| Name | Count |\n|---|---:|\n| pears | 120 |\n| apples | 3 |\n| figs | 48 |';
const rowsOf = (output: string): string[] => output.trim().split('\n').slice(2).map((l) => l.trim());

describe('markdown-table-sort', () => {
  it('sorts ascending by a numeric column given its header', async () => {
    const r = await run(T, { column: 'Count', order: 'asc' });
    expect(rowsOf(r.output)).toEqual(['| apples | 3 |', '| figs | 48 |', '| pears | 120 |']);
    expect(r.stats?.rows).toBe(3);
  });

  it('sorts descending by a numeric column', async () => {
    const r = await run(T, { column: 'Count', order: 'desc' });
    expect(rowsOf(r.output)).toEqual(['| pears | 120 |', '| figs | 48 |', '| apples | 3 |']);
  });

  it('auto-detects numeric with M/k suffixes and orders by index', async () => {
    const table =
      '| City | Population |\n|------|-----------:|\n| Osaka | 2.7M |\n| Berlin | 3.7M |\n| Lisbon | 0.5M |';
    const r = await run(table, { column: '2', order: 'asc' });
    expect(rowsOf(r.output)).toEqual(['| Lisbon | 0.5M |', '| Osaka | 2.7M |', '| Berlin | 3.7M |']);
  });

  it('falls back to text order when a column is not numeric', async () => {
    const r = await run(T, { column: 'Name', order: 'asc' });
    expect(rowsOf(r.output)).toEqual(['| apples | 3 |', '| figs | 48 |', '| pears | 120 |']);
  });

  it('is case-insensitive by default and honors the option', async () => {
    const table = '| K |\n|---|\n| beta |\n| Alpha |\n| charlie |';
    const loose = await run(table, { column: 'K', caseSensitive: false });
    expect(rowsOf(loose.output)).toEqual(['| Alpha |', '| beta |', '| charlie |']);
    const strict = await run(table, { column: 'K', caseSensitive: true });
    expect(rowsOf(strict.output)).toEqual(['| Alpha |', '| beta |', '| charlie |']);
    const strictUp = await run('| K |\n|---|\n| Beta |\n| alpha |', {
      column: 'K',
      caseSensitive: true,
    });
    expect(rowsOf(strictUp.output)).toEqual(['| Beta |', '| alpha |']);
  });

  it('keeps header and separator rows fixed', async () => {
    const r = await run(T, { column: 'Count' });
    const lines = r.output.trim().split('\n');
    expect(lines[0]).toBe('| Name | Count |');
    expect(lines[1]).toBe('|---|---:|');
  });

  it('is stable for equal values', async () => {
    const table = '| K | V |\n|---|---|\n| 1 | a |\n| 1 | b |\n| 0 | z |';
    const r = await run(table, { column: 'K', order: 'asc' });
    expect(rowsOf(r.output)).toEqual(['| 0 | z |', '| 1 | a |', '| 1 | b |']);
  });

  it('supports sorting without a separator row by index', async () => {
    const table = '| K | V |\n| b | 1 |\n| a | 2 |\n| c | 0 |';
    const r = await run(table, { column: '2' });
    // Only one header line here (no separator), so data starts at line index 1.
    const data = r.output.trim().split('\n').slice(1).map((l) => l.trim());
    expect(data).toEqual(['| c | 0 |', '| b | 1 |', '| a | 2 |']);
    expect(r.output.trim().split('\n')[0]).toBe('| K | V |');
  });

  it('errors on an unknown column', async () => {
    await expect(run(T, { column: 'Nope' })).rejects.toThrow(/column/i);
  });

  it('returns the table unchanged when there are no data rows', async () => {
    const r = await run('| A |\n|---|');
    expect(r.output.trim()).toBe('| A |\n|---|');
  });
});
