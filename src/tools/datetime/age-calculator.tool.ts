import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './age-calculator.meta';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(s: string, what: string): Date {
  const t = s.trim();
  if (DATE_ONLY.test(t)) {
    const [y, m, d] = t.split('-').map(Number);
    return new Date(Date.UTC(y!, m! - 1, d!));
  }
  const d = new Date(t);
  if (isNaN(d.getTime()))
    throw new ToolError(`That is not a valid date for ${what}.`, 'Try 2000-01-01.');
  return d;
}

const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

function zodiac(month: number, day: number): string {
  const signs: [number, number, string][] = [
    [1, 20, 'Aquarius'],
    [2, 19, 'Pisces'],
    [3, 21, 'Aries'],
    [4, 20, 'Taurus'],
    [5, 21, 'Gemini'],
    [6, 21, 'Cancer'],
    [7, 23, 'Leo'],
    [8, 23, 'Virgo'],
    [9, 23, 'Libra'],
    [10, 23, 'Scorpio'],
    [11, 22, 'Sagittarius'],
    [12, 22, 'Capricorn'],
  ];
  for (const [m, d, name] of signs) {
    if (month === m && day >= d) return name;
  }
  // Before the sign's start day in this month → the previous sign.
  const prev: Record<number, string> = {
    1: 'Capricorn',
    2: 'Aquarius',
    3: 'Pisces',
    4: 'Aries',
    5: 'Taurus',
    6: 'Gemini',
    7: 'Cancer',
    8: 'Leo',
    9: 'Virgo',
    10: 'Libra',
    11: 'Scorpio',
    12: 'Sagittarius',
  };
  return prev[month]!;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  if (!input.text.trim()) return { output: '' };

  const birth = parseDate(input.text, 'the birth date');
  const asOf = parseDate(
    String(o.asOf).trim() || new Date().toISOString().slice(0, 10),
    'the reference date',
  );
  if (birth.getTime() > asOf.getTime()) {
    throw new ToolError(
      'The birth date must be on or before the reference date.',
      'Check the dates and try again.',
    );
  }

  // Calendar breakdown (borrow-based) on UTC fields.
  let years = asOf.getUTCFullYear() - birth.getUTCFullYear();
  let months = asOf.getUTCMonth() - birth.getUTCMonth();
  let days = asOf.getUTCDate() - birth.getUTCDate();
  if (days < 0) {
    months -= 1;
    const borrowDays = new Date(
      Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 0),
    ).getUTCDate();
    days += borrowDays;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalDays = Math.floor((asOf.getTime() - birth.getTime()) / 86400000);
  const totalMonths = years * 12 + months;

  // Next birthday: birth month/day in the asOf year, rolled forward if already passed.
  let next = new Date(Date.UTC(asOf.getUTCFullYear(), birth.getUTCMonth(), birth.getUTCDate()));
  if (next.getTime() < asOf.getTime())
    next = new Date(Date.UTC(asOf.getUTCFullYear() + 1, birth.getUTCMonth(), birth.getUTCDate()));
  const daysUntil = Math.round((next.getTime() - asOf.getTime()) / 86400000);

  const born = birth.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

  const rows: string[][] = [
    ['Age', `${years} years, ${months} months, ${days} days`],
    ['Total days', String(totalDays)],
    ['Total weeks', String(Math.floor(totalDays / 7))],
    ['Total months', String(totalMonths)],
    ['Total hours', String(totalDays * 24)],
    ['Day of week born', born],
    ['Next birthday', isoDate(next)],
    ['Days until next birthday', String(daysUntil)],
    ['Western zodiac sign', zodiac(birth.getUTCMonth() + 1, birth.getUTCDate())],
  ];
  return {
    output: JSON.stringify({ headers: ['Fact', 'Value'], rows }),
    render: 'table',
    stats: { age: `${years}y` },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
