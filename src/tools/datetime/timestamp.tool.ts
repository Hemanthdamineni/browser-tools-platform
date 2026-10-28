import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './timestamp.meta';

const BAD = 'Enter a Unix timestamp or a date.';
const HINT = 'e.g. 1700000000 or 2024-01-31';

const pad = (n: number, w = 2): string => String(n).padStart(w, '0');

function rfc3339(d: Date, utc: boolean): string {
  if (utc) {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(
      d.getUTCMinutes(),
    )}:${pad(d.getUTCSeconds())}Z`;
  }
  const off = -d.getTimezoneOffset();
  const sign = off < 0 ? '-' : '+';
  const a = Math.abs(off);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}:${pad(d.getSeconds())}${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

function weekday(d: Date, utc: boolean): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', ...(utc ? { timeZone: 'UTC' } : {}) });
}

function relative(d: Date, now: Date): string {
  const diff = d.getTime() - now.getTime();
  if (Math.abs(diff) < 1000) return 'just now';
  const past = diff < 0;
  const secs = Math.floor(Math.abs(diff) / 1000);

  // Month/year buckets use calendar arithmetic (real months between the two
  // dates), not fixed 30/365-day approximations: "1 month ago" for 59 days
  // mislabels both February and 31-day months.
  let label: string;
  const months = calendarMonths(d, now);
  if (months >= 12) {
    const years = Math.floor(months / 12);
    const rem = months % 12;
    label =
      rem === 0
        ? `${years} year${years === 1 ? '' : 's'}`
        : `${years} year${years === 1 ? '' : 's'} ${rem} month${rem === 1 ? '' : 's'}`;
  } else if (months >= 1) {
    label = `${months} month${months === 1 ? '' : 's'}`;
  } else {
    const units: [number, string][] = [
      [86400, 'day'],
      [3600, 'hour'],
      [60, 'minute'],
      [1, 'second'],
    ];
    label = '';
    for (const [unitSecs, name] of units) {
      if (secs >= unitSecs) {
        const n = Math.floor(secs / unitSecs);
        label = `${n} ${name}${n === 1 ? '' : 's'}`;
        break;
      }
    }
  }
  return past ? `${label} ago` : `in ${label}`;
}

/** Whole calendar months between `d` and `now`, ignoring the time of day. */
function calendarMonths(d: Date, now: Date): number {
  const dayA = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dayB = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  // Earliest first, so the anchor adjustment works the same for future dates.
  const [from, to] = dayA <= dayB ? [d, now] : [now, d];
  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  // The day-of-month of the later date has not been reached in the span yet:
  // Mar 31 -> Apr 29 is still 0 whole months.
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const text = input.text.trim();

  let d: Date;
  if (!text) {
    d = new Date();
  } else if (/^-?\d+(\.\d+)?$/.test(text)) {
    const n = Number(text);
    const unit = String(o.unit);
    let ms: number;
    if (unit === 'seconds') ms = n * 1000;
    else if (unit === 'milliseconds') ms = n;
    else ms = Math.abs(n) <= 1e11 ? n * 1000 : n;
    d = new Date(ms);
  } else {
    d = new Date(text);
  }
  if (isNaN(d.getTime())) throw new ToolError(BAD, HINT);

  const utc = String(o.timezone) === 'utc';
  const out = String(o.output);
  const iso = utc ? d.toISOString() : rfc3339(d, false);
  const rel = relative(d, new Date());
  const epochSeconds = String(Math.floor(d.getTime() / 1000));

  if (out === 'iso') return { output: iso };
  if (out === 'rfc2822') return { output: utc ? d.toUTCString() : d.toString() };
  if (out === 'relative') return { output: rel };
  if (out === 'epoch') return { output: epochSeconds };

  const rows: string[][] = [
    ['Unix seconds', epochSeconds],
    ['Unix milliseconds', String(d.getTime())],
    ['ISO 8601', iso],
    ['RFC 2822', utc ? d.toUTCString() : d.toString()],
    ['RFC 3339', rfc3339(d, utc)],
    ['Day of week', weekday(d, utc)],
    ['Relative', rel],
  ];
  return { output: JSON.stringify({ headers: ['Format', 'Value'], rows }), render: 'table' };
}

const tool: TextToolModule = { meta, run };
export default tool;
