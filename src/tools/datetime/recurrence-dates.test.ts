import { describe, expect, it } from 'vitest';
import tool from './recurrence-dates.tool';

type Result = {
  output: string;
  render?: string;
  filename?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const dates = (text: string, options: Record<string, string | number | boolean> = {}) => {
  const parsed = JSON.parse(run(text, options).output) as { headers: string[]; rows: string[][] };
  return parsed.rows.map((r) => r[1]);
};

describe('recurrence-dates', () => {
  it('computes weekly dates on the chosen weekday, honoring the interval', () => {
    // 2026-01-02 is a Friday
    const rows = dates('2026-01-02', { mode: 'weekly', weekday: 'fri', count: 4, interval: 2 });
    expect(rows).toEqual(['2026-01-02', '2026-01-16', '2026-01-30', '2026-02-13']);
  });

  it('rolls forward to the first occurrence when the start day does not match', () => {
    // 2026-01-02 is Friday; asking for Mondays starts on the next Monday (2026-01-05)
    const rows = dates('2026-01-02', { mode: 'weekly', weekday: 'mon', count: 3 });
    expect(rows).toEqual(['2026-01-05', '2026-01-12', '2026-01-19']);
  });

  it('uses auto weekday = the weekday of the start date', () => {
    const rows = dates('2026-01-02', { mode: 'weekly', weekday: 'auto', count: 3 });
    expect(rows).toEqual(['2026-01-02', '2026-01-09', '2026-01-16']);
  });

  it('computes the Nth weekday of each month with interval', () => {
    // 2nd Tuesday of the month; 2026-01-06 was the 1st Tuesday, 2026-01-13 the 2nd
    const rows = dates('2026-01-01', { mode: 'monthly-nth', nth: '2', weekday: 'tue', count: 3 });
    expect(rows).toEqual(['2026-01-13', '2026-02-10', '2026-03-10']);
  });

  it('computes the LAST weekday of the month', () => {
    // Last Friday of Jan 2026 = 2026-01-30
    const rows = dates('2026-01-01', {
      mode: 'monthly-nth',
      nth: 'last',
      weekday: 'fri',
      count: 2,
    });
    expect(rows).toEqual(['2026-01-30', '2026-02-27']);
  });

  it('clamps short months for a fixed day-of-month pattern', () => {
    // Day 31 clamps to Feb 28 (2026 is not a leap year)
    const rows = dates('2026-01-31', { mode: 'monthly-day', count: 3 });
    expect(rows).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('skips short months when clamping is off', () => {
    const rows = dates('2026-01-31', { mode: 'monthly-day', count: 3, clamp: false });
    expect(rows).toEqual(['2026-01-31', '2026-03-31', '2026-05-31']);
  });

  it('computes yearly dates and treats leap day correctly', () => {
    const rows = dates('2024-02-29', { mode: 'yearly', count: 4 });
    expect(rows).toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28']);
    expect(rows[4]).toBeUndefined(); // only 4 asked for
    const skip = dates('2024-02-29', { mode: 'yearly', count: 4, clamp: false });
    expect(skip).toEqual(['2024-02-29', '2028-02-29', '2032-02-29', '2036-02-29']); // non-leap years are skipped entirely
  });

  it('includes the start date when it matches and excludes it otherwise', () => {
    // fixed monthly day on the same day as start includes start
    expect(dates('2026-04-15', { mode: 'monthly-day', count: 2 })).toEqual([
      '2026-04-15',
      '2026-05-15',
    ]);
  });

  it('accepts alternative date formats', () => {
    expect(dates('05/01/2026', { mode: 'weekly', weekday: 'mon', count: 1 })).toEqual([
      '2026-01-05',
    ]);
    expect(dates('18/10/2026', { mode: 'monthly-day', count: 1 })).toEqual(['2026-10-18']);
  });

  it('reports weekday labels and stats', () => {
    const result = run('2026-01-02', { mode: 'weekly', weekday: 'fri', count: 3 });
    const parsed = JSON.parse(result.output) as { headers: string[]; rows: string[][] };
    expect(parsed.rows).toEqual([
      ['1', '2026-01-02', 'Fri', 'weekly'],
      ['2', '2026-01-09', 'Fri', 'weekly'],
      ['3', '2026-01-16', 'Fri', 'weekly'],
    ]);
    expect(result.stats?.occurrences).toBe(3);
    expect(result.stats?.first).toBe('2026-01-02');
    expect(result.stats?.last).toBe('2026-01-16');
  });

  it('returns guidance when the input is blank', () => {
    const result = run('   ');
    expect(result.render).toBe('table');
    expect(result.notes?.join(' ')).toMatch(/paste a start date/i);
  });

  it('rejects invalid dates and options', () => {
    expect(() => run('not-a-date')).toThrow(/parse|date/i);
    expect(() => run('2026-02-30')).toThrow(/only 28 day/i);
    expect(() => run('2026-01-02', { mode: 'weekly', weekday: 'blah' })).toThrow(
      /choose a valid weekday/i,
    );
    expect(() => run('2026-01-02', { mode: 'monthly-nth', nth: '9', weekday: 'mon' })).toThrow(
      /nth/i,
    );
  });
});
