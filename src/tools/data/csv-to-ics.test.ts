import { describe, expect, it } from 'vitest';
import tool from './csv-to-ics.tool';

type Result = { output: string; render?: string; stats?: Record<string, number>; notes?: string[] };
const run = async (text: string, options: Record<string, string | number | boolean> = {}) =>
  (await tool.run({ text, options })) as Result;
const linesOf = (r: Result): string[] => r.output.replace(/\r/g, '').split('\n');

describe('csv-to-ics', () => {
  it('produces a VCALENDAR with one VEVENT per row', async () => {
    const r = await run('title,start,end\nStandup,2024-01-05T09:00:00,2024-01-05T09:30:00\nReview,2024-01-06T14:00:00,2024-01-06T15:00:00');
    const lines = linesOf(r);
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('VERSION:2.0');
    expect(lines).toContain('END:VCALENDAR');
    expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(2);
    expect(r.stats?.events).toBe(2);
  });

  it('emits DTSTART/DTEND as floating times by default', async () => {
    const r = await run('title,start,end\nX,2024-02-03T08:30:00,2024-02-03T09:00:00');
    const lines = linesOf(r);
    expect(lines).toContain('DTSTART:20240203T083000');
    expect(lines).toContain('DTEND:20240203T090000');
    expect(lines).toContain('SUMMARY:X');
  });

  it('defaults missing end to a one-hour duration', async () => {
    const r = await run('title,start\nX,2024-01-01T23:00:00');
    expect(linesOf(r)).toContain('DTSTART:20240101T230000');
    expect(linesOf(r)).toContain('DTEND:20240102T000000');
  });

  it('turns date-only rows into all-day events with exclusive DTEND', async () => {
    const r = await run('title,start\nHoliday,2024-12-25');
    const lines = linesOf(r);
    expect(lines).toContain('DTSTART;VALUE=DATE:20241225');
    expect(lines).toContain('DTEND;VALUE=DATE:20241226');
  });

  it('escapes commas, semicolons and backslashes in text', async () => {
    const r = await run('title,start,description\n"Menu, part 1",2024-01-01T09:00:00,"a;b\\c"');
    expect(linesOf(r)).toContain('SUMMARY:Menu\\, part 1');
    expect(linesOf(r)).toContain('DESCRIPTION:a\\;b\\\\c');
  });

  it('supports US dates with AM/PM', async () => {
    const r = await run('title,start,end\nCall,01/05/2024 2:30 PM,01/05/2024 3:00 PM', { dateFormat: 'us' });
    const lines = linesOf(r);
    expect(lines).toContain('DTSTART:20240105T143000');
    expect(lines).toContain('DTEND:20240105T150000');
  });

  it('appends Z when UTC is requested', async () => {
    const r = await run('title,start\nX,2024-03-01T12:00:00', { utc: true });
    expect(linesOf(r)).toContain('DTSTART:20240301T120000Z');
  });

  it('rejects empty input and unparseable files', async () => {
    await expect(run('   ')).rejects.toThrow(/paste csv/i);
    await expect(run('title,start\na,,b')).rejects.toThrow(/no parseable events/i);
  });
});
