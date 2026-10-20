import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './workday-calculator.meta';

type Row = [string, string];
type Weekday = 'ss' | 'fs' | 'tf';

const MS_DAY = 86400000;

function parseISO(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) throw new ToolError(`"${s.trim()}" is not a valid date — use YYYY-MM-DD.`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    throw new ToolError(`"${s.trim()}" is not a real calendar date.`);
  }
  return Math.round(dt.getTime() / MS_DAY);
}

function isoFromDay(day: number): string {
  const dt = new Date(day * MS_DAY);
  const y = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

function isWeekend(day: number, weekend: Weekday): boolean {
  const dow = (day + 3) % 7; // 0 = Monday … 6 = Sunday
  switch (weekend) {
    case 'fs': return dow === 4 || dow === 5;   // Fri + Sat
    case 'tf': return dow === 3 || dow === 4;   // Thu + Fri
    default: return dow === 5 || dow === 6;     // Sat + Sun
  }
}

function isBusinessDay(day: number, weekend: Weekday, holidays: Set<number>): boolean {
  if (isWeekend(day, weekend)) return false;
  return !holidays.has(day);
}

function parseHolidays(raw: string): Set<number> {
  const out = new Set<number>();
  for (const line of raw.split(/\r\n|\r|\n/)) {
    const t = line.trim();
    if (t) out.add(parseISO(t));
  }
  return out;
}

function addBusinessDays(start: number, count: number, weekend: Weekday, holidays: Set<number>): number {
  let day = start;
  const step = count < 0 ? -1 : 1;
  let remaining = Math.abs(count);
  while (remaining > 0) {
    day += step;
    if (isBusinessDay(day, weekend, holidays)) remaining--;
  }
  return day;
}

function countBusinessDays(a: number, b: number, weekend: Weekday, holidays: Set<number>): number {
  if (a > b) [a, b] = [b, a];
  let count = 0;
  for (let day = a; day <= b; day++) {
    if (isBusinessDay(day, weekend, holidays)) count++;
  }
  return count;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const mode = String(o.mode);
  const weekend = String(o.weekend) as Weekday;
  const holidays = parseHolidays(String(o.holidays));
  const raw = input.text.trim();

  if (!raw) {
    return { output: JSON.stringify({ headers: ['Property', 'Value'], rows: [] as Row[] }), render: 'table', notes: ['Add mode: START,N → the business day N working days after START. Between mode: START to END → the number of working days in between (inclusive).'] };
  }

  if (mode === 'between') {
    let a: number; let b: number;
    const toMatch = /^([0-9]{4}-[0-9]{2}-[0-9]{2})\s+to\s+([0-9]{4}-[0-9]{2}-[0-9]{2})$/i.exec(raw);
    const commaMatch = /^([0-9]{4}-[0-9]{2}-[0-9]{2}),\s*([0-9]{4}-[0-9]{2}-[0-9]{2})$/.exec(raw);
    if (toMatch) { a = parseISO(toMatch[1]!); b = parseISO(toMatch[2]!); }
    else if (commaMatch) { a = parseISO(commaMatch[1]!); b = parseISO(commaMatch[2]!); }
    else {
      throw new ToolError('Between mode expects "START to END" or "START,END" with YYYY-MM-DD dates (e.g. 2026-01-05 to 2026-01-16).');
    }
    const count = countBusinessDays(a, b, weekend, holidays);
    const totalDays = Math.abs(b - a) + 1;
    const rows: Row[] = [
      ['From', isoFromDay(a)],
      ['To', isoFromDay(b)],
      ['Business days', String(count)],
      ['Weekend', weekend === 'ss' ? 'Sat + Sun' : weekend === 'fs' ? 'Fri + Sat' : 'Thu + Fri'],
      ['Holidays applied', String(count === countBusinessDays(a, b, weekend, new Set()) ? 'none of the listed dates fall on a working day' : `skipped ${holidays.size} listed${holidays.size === 1 ? ' date' : ' dates'}`)],
    ];
    return {
      output: JSON.stringify({ headers: ['Property', 'Value'], rows }),
      render: 'table',
      stats: { businessDays: count, totalDays, ...(holidays.size ? { holidayBase: countBusinessDays(a, b, weekend, holidays), holidaySkipped: countBusinessDays(a, b, weekend, new Set()) - count } : { holidaySkipped: 0 }) },
      notes: [`${count} business day${count === 1 ? '' : 's'} between ${isoFromDay(a)} and ${isoFromDay(b)} (inclusive).`],
    };
  }

  // mode === 'add'
  const parts = raw.split(',');
  if (parts.length < 2) {
    throw new ToolError('Add mode expects "START,N" where START is YYYY-MM-DD and N is a whole number of business days (e.g. 2026-01-05,10). Negative N moves backwards.');
  }
  const start = parseISO(parts[0]!);
  if (!/^-?\d+$/.test(parts[1]!.trim())) throw new ToolError('The day count must be a whole number (e.g. 10 or -5).');
  const count = Number(parts[1]!.trim());
  if (Math.abs(count) > 100000) throw new ToolError('The day count is too large (max 100,000).');
  const res = addBusinessDays(start, count, weekend, holidays);
  const rows: Row[] = [
    ['Start date', isoFromDay(start)],
    ['Business days', String(count)],
    ['Result date', isoFromDay(res)],
    ['Weekend', weekend === 'ss' ? 'Sat + Sun' : weekend === 'fs' ? 'Fri + Sat' : 'Thu + Fri'],
  ];
  if (holidays.size) rows.push(['Holidays', String(holidays.size)]);
  return {
    output: JSON.stringify({ headers: ['Property', 'Value'], rows }),
    render: 'table',
    stats: { startDay: start, n: count, resultDay: res },
    notes: count === 0 ? [`${isoFromDay(start)} is the first business day at/after the start.`] : [`N=${count} business day${Math.abs(count) === 1 ? '' : 's'} after ${isoFromDay(start)} lands on ${isoFromDay(res)} (${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][(res + 3) % 7]}).`],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
