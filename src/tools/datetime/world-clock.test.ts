import { describe, expect, it } from 'vitest';
import tool from './world-clock.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;
const table = (r: Result): { headers: string[]; rows: string[][] } =>
  JSON.parse(r.output) as { headers: string[]; rows: string[][] };

function minutesOfDay(t: string): number {
  const [h, m] = t.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

describe('world-clock', () => {
  it('shows time, date and fixed offsets for zones', async () => {
    const r = await run('UTC, Asia/Kolkata');
    const { headers, rows } = table(r);
    expect(headers).toEqual(['Zone', 'Time', 'Offset', 'Date']);
    expect(rows).toHaveLength(2);
    const utc = rows.find((row) => row[0] === 'UTC')!;
    const kol = rows.find((row) => row[0] === 'Asia/Kolkata')!;
    expect(utc[2]).toBe('+00:00');
    expect(kol[2]).toBe('+05:30');
    expect(utc[1]).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(utc[3]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('UTC and Kolkata differ by exactly 330 minutes', async () => {
    const r = await run('UTC, Asia/Kolkata');
    const rows = table(r).rows;
    const mins = rows.map((row) => minutesOfDay(row[1]!));
    const diff = (mins[1]! - mins[0]! + 1440) % 1440;
    expect(diff).toBe(330);
  });

  it('supports 12-hour time', async () => {
    const r = await run('UTC', { hour12: true });
    expect(table(r).rows[0]![1]).toMatch(/(AM|PM)$/);
  });

  it('drops the date column when requested', async () => {
    const r = await run('UTC', { showDate: false });
    expect(table(r).headers).toEqual(['Zone', 'Time', 'Offset']);
  });

  it('uses defaults when input is empty and ignores unknown zones', async () => {
    const r = await run('');
    const rows = table(r).rows;
    expect(rows.length).toBeGreaterThanOrEqual(3);
    const bogus = await run('Mars/Phobos, UTC');
    const bogusRows = table(bogus).rows;
    expect(bogusRows).toHaveLength(1);
    expect((bogus.notes ?? []).join(' ')).toMatch(/Mars\/Phobos/);
  });

  it('dedupes repeated zones and rejects all-invalid input', async () => {
    const r = await run('UTC, UTC\nUTC');
    expect(table(r).rows).toHaveLength(1);
    await expect(run('Mars/Phobos')).rejects.toThrow(/no valid time zones/i);
  });
});
