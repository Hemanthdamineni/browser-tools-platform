import { describe, expect, it } from 'vitest';
import tool from './workday-calculator.tool';

type Result = {
  output: string;
  render?: string;
  stats?: Record<string, string | number>;
  notes?: string[];
};
type Table = { headers: string[]; rows: [string, string][] };

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options }) as Result;
const table = (text: string, options: Record<string, string | number | boolean> = {}) =>
  JSON.parse(run(text, options).output) as Table;
const get = (text: string, key: string, options: Record<string, string | number | boolean> = {}) =>
  table(text, options).rows.find((r) => r[0] === key)?.[1];

describe('workday-calculator', () => {
  it('shows guidance on blank input', () => {
    const result = run(' ');
    expect(result.render).toBe('table');
    expect(result.notes?.join(' ')).toMatch(/business day/i);
  });

  describe('add mode', () => {
    it('adds 1 business day past a Friday to Monday', () => {
      // Fri 2026-01-09 + 1 → Mon 2026-01-12
      expect(get('2026-01-09,1', 'Result date')).toBe('2026-01-12');
    });

    it('adds 0 business days returns the start date unchanged', () => {
      expect(get('2026-01-09,0', 'Result date')).toBe('2026-01-09');
    });

    it('subtracts business days backward from a Monday', () => {
      // Mon 2026-01-12 - 1 → Fri 2026-01-09
      expect(get('2026-01-12,-1', 'Result date')).toBe('2026-01-09');
    });

    it('skips a holiday when adding', () => {
      // Mon 2026-01-05 + 1 → skip Tue (holiday) → Wed 2026-01-07
      const holidays = { holidays: '2026-01-06' };
      expect(get('2026-01-05,1', 'Result date', holidays)).toBe('2026-01-07');
    });

    it('adds multiple business days across weeks', () => {
      // Mon 2026-01-05 + 5 = Mon 2026-01-12
      expect(get('2026-01-05,5', 'Result date')).toBe('2026-01-12');
    });

    it('honours the Fri+Sat weekend option', () => {
      // Thu 2026-01-15 + 1 → Fri+Sat skipped → Sun 2026-01-18 (Sunday is a workday in Fri+Sat weekends)
      expect(get('2026-01-15,1', 'Result date', { weekend: 'fs' })).toBe('2026-01-18');
    });

    it('rejects invalid date format', () => {
      expect(() => run('not-a-date,5')).toThrow(/not a valid date/i);
      expect(() => run('2026-01-01,abc')).toThrow(/whole number/i);
    });

    it('rejects a date-only input', () => {
      expect(() => run('2026-01-01')).toThrow(/expect.*START.*N/i);
    });

    it('runs the "Business days around a holiday" example without throwing', () => {
      // Mon 2026-12-21 + 7 business days, skipping 12-24 (Thu), 12-25 (Fri) and weekends → Fri 2027-01-01
      const result = run('2026-12-21,7', { holidays: '2026-12-24\n2026-12-25' });
      expect(result.render).toBe('table');
      expect(get('2026-12-21,7', 'Result date', { holidays: '2026-12-24\n2026-12-25' })).toBe(
        '2027-01-01',
      );
      expect(result.output.length).toBeGreaterThan(0);
    });
  });

  describe('between mode', () => {
    it('counts business days between two dates', () => {
      // Mon 2026-01-05 to Fri 2026-01-09 = 5 days
      expect(get('2026-01-05 to 2026-01-09', 'Business days', { mode: 'between' })).toBe('5');
    });

    it('counts one business day when from and to are the same working day', () => {
      expect(get('2026-01-05,2026-01-05', 'Business days', { mode: 'between' })).toBe('1');
    });

    it('excludes weekends from the count', () => {
      // Mon 2026-01-05 to Mon 2026-01-19 = 11 working days (excludes Sat+Sun × 2)
      expect(get('2026-01-05 to 2026-01-19', 'Business days', { mode: 'between' })).toBe('11');
    });

    it('skips holidays when counting', () => {
      expect(
        get('2026-01-05 to 2026-01-09', 'Business days', {
          mode: 'between',
          holidays: '2026-01-07',
        }),
      ).toBe('4');
    });

    it('rejects invalid between input', () => {
      expect(() => run('2026-01-01 to not-a-date', { mode: 'between' })).toThrow(
        /expect.*START to END/i,
      );
      expect(() => run('2026-01-01 between 2026-01-31', { mode: 'between' })).toThrow(
        /expect.*START to END/i,
      );
    });

    it('reports the note with the correct count', () => {
      const result = run('2026-01-05 to 2026-01-09', { mode: 'between' });
      expect(result.notes?.join(' ')).toMatch('5 business day');
    });
  });
});
