import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './date-diff.meta';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(s: string, what: string): Date {
  const t = s.trim();
  if (DATE_ONLY.test(t)) {
    const [y, m, d] = t.split('-').map(Number);
    return new Date(Date.UTC(y!, m! - 1, d!));
  }
  const d = new Date(t);
  if (isNaN(d.getTime()))
    throw new ToolError(
      `That is not a valid date for ${what}.`,
      'Try 2024-01-31 or 2024-01-31T12:00:00Z.',
    );
  return d;
}

const trimNum = (n: number): string =>
  Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));

/** Borrow-based calendar breakdown from `a` to `b`, both in UTC fields, a <= b. */
function calendarBreakdown(a: Date, b: Date): { years: number; months: number; days: number } {
  let years = b.getUTCFullYear() - a.getUTCFullYear();
  let months = b.getUTCMonth() - a.getUTCMonth();
  let days = b.getUTCDate() - a.getUTCDate();
  if (days < 0) {
    let borrowMonth = b.getUTCMonth() - 1;
    let borrowYear = b.getUTCFullYear();
    while (days < 0) {
      months -= 1;
      // Days in the month before b's month; Date.UTC normalises month indices below zero across years.
      const borrowDays = new Date(Date.UTC(borrowYear, borrowMonth + 1, 0)).getUTCDate();
      days += borrowDays;
      borrowMonth -= 1;
      if (borrowMonth < 0) {
        borrowMonth += 12;
        borrowYear -= 1;
      }
    }
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

function businessDays(from: Date, to: Date): number {
  let count = 0;
  const cur = new Date(from.getTime());
  while (cur.getTime() < to.getTime()) {
    const wd = cur.getUTCDay();
    if (wd !== 0 && wd !== 6) count += 1;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const a = parseDate(input.text || new Date().toISOString(), 'the first date');
  const secondText = String(o.second).trim();
  const b = parseDate(secondText || new Date().toISOString(), 'the second date');

  const diffMs = b.getTime() - a.getTime();
  const earlier = diffMs >= 0 ? a : b;
  const later = diffMs >= 0 ? b : a;
  const cal = calendarBreakdown(earlier, later);
  const completeMonths = cal.years * 12 + cal.months;
  const bd = businessDays(earlier, later);
  const relation = diffMs === 0 ? 'A is equal to B' : diffMs > 0 ? 'A is after B' : 'A is before B';

  const rows: string[][] = [
    ['Total milliseconds', trimNum(diffMs)],
    ['Total seconds', trimNum(diffMs / 1000)],
    ['Total minutes', trimNum(diffMs / 60000)],
    ['Total hours', trimNum(diffMs / 3600000)],
    ['Total days', trimNum(diffMs / 86400000)],
    ['Total weeks', trimNum(diffMs / 604800000)],
    ['Calendar breakdown', `${cal.years} years, ${cal.months} months, ${cal.days} days`],
    ['Total complete months', String(diffMs >= 0 ? completeMonths : -completeMonths)],
    ['Business days', String(bd)],
    ['Relation', relation],
  ];
  return {
    output: JSON.stringify({ headers: ['Measure', 'Value'], rows }),
    render: 'table',
    stats: { days: trimNum(Math.abs(diffMs) / 86400000) },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
