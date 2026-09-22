import { describe, it, expect } from 'vitest';
import tool from './timestamp.tool';
import { ToolError } from '@/lib/types';

interface Res {
  output: string;
  render?: string;
}
const run = async (
  text: string,
  options: Record<string, string | number | boolean> = {},
): Promise<Res> => await tool.run({ text, options });
const table = (r: Res) => JSON.parse(r.output) as { rows: string[][] };
const row = (r: Res, key: string): string => {
  const t = table(r);
  const found = t.rows.find((x) => x[0] === key);
  if (!found) throw new Error(`missing row ${key}`);
  return found[1]!;
};

describe('timestamp', () => {
  it('converts a Unix timestamp in seconds to ISO 8601', async () => {
    expect((await run('1700000000', { output: 'iso' })).output).toBe('2023-11-14T22:13:20.000Z');
  });

  it('handles the epoch itself', async () => {
    expect((await run('0', { output: 'iso' })).output).toBe('1970-01-01T00:00:00.000Z');
  });

  it('converts a date back to Unix seconds', async () => {
    expect((await run('2024-02-29T00:00:00Z', { output: 'epoch' })).output).toBe('1709164800');
  });

  it('auto-detect treats small numbers as seconds and large as milliseconds', async () => {
    expect((await run('1700000000000', { output: 'iso' })).output).toBe('2023-11-14T22:13:20.000Z');
    expect((await run('1700000000', { unit: 'milliseconds', output: 'iso' })).output).toBe(
      '1970-01-20T16:13:20.000Z',
    );
  });

  it('emits every format in the all-outputs table', async () => {
    const r = await run('1700000000');
    expect(JSON.parse(r.output)).toHaveProperty('headers', ['Format', 'Value']);
    expect(row(r, 'Unix seconds')).toBe('1700000000');
    expect(row(r, 'ISO 8601')).toBe('2023-11-14T22:13:20.000Z');
    expect(row(r, 'Day of week')).toBe('Tuesday');
  });

  it('gives a relative time in the past', async () => {
    expect(await run('0', { output: 'relative' })).toMatchObject({
      output: expect.stringMatching(/ago$/),
    });
  });

  it('rejects unparseable input', async () => {
    await expect(run('not a date')).rejects.toThrow(ToolError);
    await expect(run('not a date')).rejects.toThrow(/Unix timestamp or a date/);
  });

  it('empty input falls back to now as a table', async () => {
    const r = await run('');
    expect(r.render).toBe('table');
    expect(table(r).rows.length).toBeGreaterThanOrEqual(7);
  });
});
