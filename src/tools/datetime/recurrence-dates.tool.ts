import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './recurrence-dates.meta';

type Day = [number, number, number]; // [y, m, d]

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmt(date: Day): string {
  return `${String(date[0]).padStart(4, '0')}-${String(date[1]).padStart(2, '0')}-${String(date[2]).padStart(2, '0')}`;
}

function addDays(y: number, m: number, d: number, n: number): Day {
  const t = Date.UTC(y, m - 1, d) + n * 86400000;
  const dt = new Date(t);
  return [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()];
}

function weekdayIndex(date: Day): number {
  // 0 = Monday ... 6 = Sunday
  return (new Date(Date.UTC(date[0], date[1] - 1, date[2])).getUTCDay() + 6) % 7;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Lexicographic [y, m, d] comparison: negative when a is before b. */
function cmp(a: Day, b: Day): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

function parseDate(text: string): Day {
  const s = text.trim().replace(/\s+/g, ' ');
  const mdy = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(s);
  let y = 0;
  let m = 0;
  let d = 0;
  if (mdy) {
    y = Number(mdy[1]);
    m = Number(mdy[2]);
    d = Number(mdy[3]);
  } else if (dmy) {
    const a = Number(dmy[1]);
    const b = Number(dmy[2]);
    y = Number(dmy[3]);
    if (a <= 12 && b > 12) { m = a; d = b; }
    else if (a > 12 && b <= 12) { m = b; d = a; }
    else { m = b; d = a; } // prefer day/month when both could be months
  } else {
    throw new ToolError('Enter the start date as YYYY-MM-DD (for example 2026-10-18).');
  }
  if (!Number.isInteger(y) || y < 1900 || y > 9999 || m < 1 || m > 12 || d < 1) {
    throw new ToolError(`"${s}" is not a valid calendar date.`);
  }
  const dim = daysInMonth(y, m);
  if (d > dim) throw new ToolError(`"${s}" is not a valid date — ${MONTHS[m - 1]} ${y} has only ${dim} day(s).`);
  return [y, m, d];
}

function resolveWeekday(o: Record<string, string | number | boolean>, start: Day): number {
  const wd = String(o.weekday);
  if (wd === 'auto') return weekdayIndex(start);
  const idx = WEEKDAYS.indexOf(wd);
  if (idx === -1) throw new ToolError('Choose a valid weekday.');
  return idx;
}

function nthDateOfMonth(y: number, m: number, wd: number, nth: string): Day | null {
  const dim = daysInMonth(y, m);
  const first = ((wd - weekdayIndex([y, m, 1]) + 7) % 7) + 1; // first day in month with weekday wd
  if (nth === 'last') {
    const last = first + (Math.floor((dim - first) / 7)) * 7;
    return [y, m, last];
  }
  const idx = Number(nth);
  const day = first + (idx - 1) * 7;
  if (day > dim) return null;
  return [y, m, day];
}

function occurrences(start: Day, o: Record<string, string | number | boolean>): Day[] {
  const mode = String(o.mode);
  const count = Math.max(1, Math.min(50, Number(o.count)));
  const interval = Math.max(1, Math.min(12, Math.trunc(Number(o.interval))));
  const clamp = Boolean(o.clamp);
  const out: Day[] = [];

  if (mode === 'weekly') {
    const wd = resolveWeekday(o, start);
    // first occurrence at/after start whose weekday matches
    const offset = (wd - weekdayIndex(start) + 7) % 7;
    let cur = addDays(start[0], start[1], start[2], offset);
    while (out.length < count) {
      out.push(cur);
      cur = addDays(cur[0], cur[1], cur[2], interval * 7);
    }
    return out;
  }

  if (mode === 'monthly-nth') {
    const wd = resolveWeekday(o, start);
    const nth = String(o.nth);
    if (!/^(1|2|3|4|last)$/.test(nth)) throw new ToolError('Choose a valid nth occurrence (1st–4th or last).');
    let y = start[0];
    let m = start[1];
    for (let guard = 0; out.length < count && guard < 60000; guard++) {
      const cand = nthDateOfMonth(y, m, wd, nth);
      if (cand && cmp(cand, start) >= 0) {
        out.push(cand);
      }
      m += interval;
      while (m > 12) { m -= 12; y++; }
    }
    return out;
  }

  if (mode === 'monthly-day') {
    let y = start[0];
    let m = start[1];
    const day = start[2];
    for (let guard = 0; out.length < count && guard < 60000; guard++) {
      const dim = daysInMonth(y, m);
      const candDay = clamp ? Math.min(day, dim) : day;
      if (candDay <= dim) {
        const cand: Day = [y, m, candDay];
        if (cmp(cand, start) >= 0) {
          out.push(cand);
        }
      }
      m += interval;
      while (m > 12) { m -= 12; y++; }
    }
    return out;
  }

  if (mode === 'yearly') {
    const month = start[1];
    const day = start[2];
    let y = start[0];
    for (let guard = 0; out.length < count && guard < 60000; guard++) {
      const dim = daysInMonth(y, month);
      const candDay = clamp ? Math.min(day, dim) : day;
      if (candDay <= dim) {
        const cand: Day = [y, month, candDay];
        if (cmp(cand, start) >= 0) out.push(cand);
      }
      y += interval;
    }
    return out;
  }

  throw new ToolError('Choose a valid pattern.');
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const mode = String(o.mode);
  const text = input.text.trim();
  if (!text) {
    return {
      output: JSON.stringify({ headers: ['#', 'Date', 'Weekday', 'Occurrence'], rows: [] as string[][] }),
      render: 'table',
      notes: ['Paste a start date (YYYY-MM-DD) and pick a repeating pattern to list its upcoming dates.'],
    };
  }
  const start = parseDate(text);
  const dates = occurrences(start, o);
  const labels: Record<string, string> = { 'monthly-day': 'same day monthly', 'monthly-nth': 'nth weekday monthly', weekly: 'weekly', yearly: 'yearly' };
  const modeLabel = labels[mode] ?? mode;
  const rows = dates.map((d, idx) => [String(idx + 1), fmt(d), WEEKDAY_LABELS[weekdayIndex(d)]!, modeLabel]);
  const first = dates[0];
  const last = dates[dates.length - 1];
  return {
    output: JSON.stringify({ headers: ['#', 'Date', 'Weekday', 'Occurrence'], rows }),
    render: 'table',
    stats: {
      occurrences: dates.length,
      first: first ? fmt(first) : '',
      last: last ? fmt(last) : '',
      spanDays: first && last ? Math.round((Date.UTC(last[0], last[1] - 1, last[2]) - Date.UTC(first[0], first[1] - 1, first[2])) / 86400000) + 1 : 0,
    },
    notes: [`Pattern: ${modeLabel}. Dates are computed in local calendar terms; short months ${o.clamp ? 'clamp to the last day (so the 31st lands on the 30th)' : 'are skipped when the day is missing'}.`],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
