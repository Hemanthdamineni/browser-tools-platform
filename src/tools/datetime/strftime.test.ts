import { describe, expect, it } from 'vitest';
import tool from './strftime.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;

const EPOCH_2000 = 946684800; // 2000-01-01T00:00:00Z

describe('strftime', () => {
  it('formats epoch 0 in UTC', async () => {
    const r = await run('%Y-%m-%d %H:%M:%S', { at: 0, utc: true });
    expect(r.output).toBe('1970-01-01 00:00:00\n');
    expect(r.stats?.length).toBe(19);
  });

  it('expands %s and %% and composite tokens', async () => {
    expect((await run('%s', { at: 0, utc: true })).output).toBe('0\n');
    expect((await run('%%', { at: 0, utc: true })).output).toBe('%\n');
    expect((await run('%F %T', { at: 946731705, utc: true })).output).toBe('2000-01-01 13:01:45\n');
  });

  it('renders names and weekday numbers', async () => {
    const r = await run('%a|%A|%b|%B|%w|%u', { at: EPOCH_2000, utc: true });
    expect(r.output).toBe('Sat|Saturday|Jan|January|6|6\n');
  });

  it('computes day of year and week numbers', async () => {
    const leap = await run('%j|%U|%W', { at: EPOCH_2000, utc: true });
    expect(leap.output).toBe('001|0|0\n');
    // March 1 of the leap year 2000 is day 61
    const mar = await run('%j', { at: 951868800, utc: true });
    expect(mar.output).toBe('061\n');
  });

  it('handles 12-hour clock and AM/PM', async () => {
    const r = await run('%I:%M %p %P', { at: 951868815, utc: true });
    expect(r.output).toBe('12:00 AM am\n');
  });

  it('keeps unknown tokens and flags them', async () => {
    const r = await run('a %q b', { at: 0, utc: true });
    expect(r.output).toBe('a %q b\n');
    expect((r.notes ?? []).join(' ')).toContain('Unknown token');
  });

  it('rejects an empty format string', async () => {
    await expect(run('   ')).rejects.toThrow(/paste a strftime format string/i);
  });
});
