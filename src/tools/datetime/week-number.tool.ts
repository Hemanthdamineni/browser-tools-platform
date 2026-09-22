import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './week-number.meta';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86400000;
const pad = (n: number, w = 2): string => String(n).padStart(w, '0');

function parseDate(s: string): Date {
  const t = s.trim();
  if (DATE_ONLY.test(t)) {
    const [y, m, d] = t.split('-').map(Number);
    return new Date(Date.UTC(y!, m! - 1, d!));
  }
  const d = new Date(t);
  if (isNaN(d.getTime())) throw new ToolError('That is not a valid date.', 'Try 2024-01-31.');
  return d;
}

const isoDate = (d: Date): string => d.toISOString().slice(0, 10);
const isLeap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  void o;
  const d = parseDate(input.text || new Date().toISOString());
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();

  // ISO 8601 week: move to the Thursday of this ISO week.
  const thu = new Date(d.getTime());
  thu.setUTCDate(thu.getUTCDate() - ((thu.getUTCDay() + 6) % 7) + 3);
  const isoYear = thu.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const week1ThuMs = jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * DAY_MS + 3 * DAY_MS;
  const week = 1 + Math.round((thu.getTime() - week1ThuMs) / (7 * DAY_MS));

  const dayOfYear = Math.round((Date.UTC(y, m, day) - Date.UTC(y, 0, 1)) / DAY_MS) + 1;
  const daysRemaining = Math.round((Date.UTC(y + 1, 0, 1) - d.getTime()) / DAY_MS) - 1;
  const quarter = Math.floor(m / 3) + 1;
  const quarterStart = Date.UTC(y, quarter * 3 - 3, 1);
  const dayOfQuarter = Math.round((Date.UTC(y, m, day) - quarterStart) / DAY_MS) + 1;

  const weekStart = new Date(thu.getTime() - 3 * DAY_MS);
  const weekEnd = new Date(thu.getTime() + 3 * DAY_MS);

  const rows: string[][] = [
    ['ISO week number', String(week)],
    ['ISO week-year', String(isoYear)],
    ['Day of year', String(dayOfYear)],
    ['Days remaining in year', String(daysRemaining)],
    ['Quarter', `Q${quarter}`],
    ['Day of quarter', String(dayOfQuarter)],
    ['Leap year', isLeap(y) ? 'Yes' : 'No'],
    ['Ordinal date', `${y}-${pad(dayOfYear, 3)}`],
    ['ISO week start (Mon)', isoDate(weekStart)],
    ['ISO week end (Sun)', isoDate(weekEnd)],
  ];
  return {
    output: JSON.stringify({ headers: ['Fact', 'Value'], rows }),
    render: 'table',
    stats: { week: `${isoYear}-W${pad(week)}` },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
