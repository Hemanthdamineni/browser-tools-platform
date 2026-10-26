import { describe, it, expect } from 'vitest';
import tool from './timezone-convert.tool';
import { ToolError } from '@/lib/types';

interface Res {
  output: string;
  render?: string;
  stats?: Record<string, string | number>;
}
const run = async (
  text: string,
  options: Record<string, string | number | boolean> = {},
): Promise<Res> => await tool.run({ text, options });
const table = (r: Res) => JSON.parse(r.output) as { rows: string[][] };
const rowOf = (r: Res, zone: string): string => {
  const found = table(r).rows.find((x) => x[0] === zone);
  if (!found) throw new Error(`missing zone ${zone}`);
  return found[1]!;
};

describe('timezone-convert', () => {
  it('converts noon UTC across the world (winter = standard time)', async () => {
    const r = await run('2024-01-15 12:00');
    expect(rowOf(r, 'Asia/Kolkata')).toMatch(/17:30/);
    expect(rowOf(r, 'America/New_York')).toMatch(/07:00/);
  });

  it('handles seconds in the input', async () => {
    const r = await run('2024-01-15T12:00:30', { targets: 'europe' });
    expect(rowOf(r, 'Europe/London')).toMatch(/12:00/);
  });

  it('respects the fromZone option', async () => {
    const r = await run('2024-01-15 09:00', { fromZone: 'America/New_York', targets: 'us' });
    expect(rowOf(r, 'America/Los_Angeles')).toMatch(/06:00/);
  });

  it('filters the target list by region', async () => {
    const r = await run('2024-01-15 12:00', { targets: 'asia' });
    const zones = table(r).rows.map((x) => x[0]!);
    expect(zones).toContain('Asia/Tokyo');
    expect(zones).not.toContain('America/New_York');
    expect(r.stats!.zones).toBe(8);
  });

  it('empty input falls back to now', async () => {
    const r = await run('');
    expect(r.render).toBe('table');
    expect(table(r).rows.length).toBeGreaterThanOrEqual(8);
  });

  it('rejects unparseable input', async () => {
    await expect(run('tomorrow-ish')).rejects.toThrow(ToolError);
    await expect(run('tomorrow-ish')).rejects.toThrow(/not a valid date and time/);
  });

  it('runs the "Now, US zones" example without throwing', async () => {
    const r = await run('', { targets: 'us' });
    expect(r.render).toBe('table');
    const zones = table(r).rows.map((x) => x[0]!);
    expect(zones).toContain('America/New_York');
    expect(r.output.length).toBeGreaterThan(0);
  });
});
