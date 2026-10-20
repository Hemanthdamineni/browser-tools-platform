import { describe, expect, it } from 'vitest';
import { ToolError } from '@/lib/types';
import tool from './rrule-builder.tool';

type Result = { output: string; stats?: Record<string, string | number>; notes?: string[] };
const run = (options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text: '', options }) as Result;

describe('rrule-builder', () => {
  it('builds a weekly recurrence with ordered weekdays and count', () => {
    const out = run({ frequency: 'WEEKLY', weekdays: 'FR,mo,WE', count: 8 });
    expect(out.output).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=8');
    expect(out.notes?.[0]).toContain('Monday, Wednesday, Friday');
  });

  it('builds interval and monthly day rules', () => {
    expect(run({ frequency: 'MONTHLY', interval: 2, monthDay: 15 }).output).toBe(
      'RRULE:FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=15',
    );
  });

  it('uses a UTC date-time for UNTIL and accepts leap day', () => {
    expect(run({ frequency: 'YEARLY', until: '2028-02-29' }).output).toBe(
      'RRULE:FREQ=YEARLY;UNTIL=20280229T235959Z',
    );
  });

  it('uses DTSTART weekday when weekly BYDAY is omitted', () => {
    const out = run({ frequency: 'WEEKLY' });
    expect(out.output).toBe('RRULE:FREQ=WEEKLY');
    expect(out.notes?.join(' ')).toContain('weekday of DTSTART');
  });

  it('rejects invalid frequency, ranges and conflicting end conditions', () => {
    expect(() => run({ frequency: 'HOURLY' })).toThrow(ToolError);
    expect(() => run({ interval: 0 })).toThrow(/interval/i);
    expect(() => run({ count: 2.5 })).toThrow(/count/i);
    expect(() => run({ count: 2, until: '2026-12-31' })).toThrow(/either/i);
    expect(() => run({ until: '2026-02-29' })).toThrow(/real calendar date/i);
  });

  it('rejects invalid and duplicate weekdays or inapplicable weekday options', () => {
    expect(() => run({ frequency: 'WEEKLY', weekdays: 'MO,XX' })).toThrow(/weekday codes/i);
    expect(() => run({ frequency: 'WEEKLY', weekdays: 'MO,MO' })).toThrow(/once/i);
    expect(() => run({ frequency: 'DAILY', weekdays: 'MO' })).toThrow(/only available/i);
  });

  it('warns for monthly dates absent from some months', () => {
    expect(run({ frequency: 'MONTHLY', monthDay: 31 }).notes?.join(' ')).toContain(
      'Months without',
    );
    expect(() => run({ frequency: 'MONTHLY', monthDay: 32 })).toThrow(/day of month/i);
  });
});
