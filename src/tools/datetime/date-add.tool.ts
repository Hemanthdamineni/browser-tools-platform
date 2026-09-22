import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './date-add.meta';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const trimNum = (n: number): string =>
  Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));

function parseBase(s: string): Date {
  const t = s.trim();
  if (DATE_ONLY.test(t)) {
    const [y, m, d] = t.split('-').map(Number);
    return new Date(Date.UTC(y!, m! - 1, d!));
  }
  const d = new Date(t);
  if (isNaN(d.getTime()))
    throw new ToolError('That is not a valid date.', 'Try 2024-01-31 or 2024-01-31T12:00:00Z.');
  return d;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const base = parseBase(input.text || new Date().toISOString());
  const sign = String(o.operation) === 'subtract' ? -1 : 1;

  // Calendar years/months first, on UTC fields, clamping the day of month.
  let y = base.getUTCFullYear() + sign * Number(o.years);
  let mo = base.getUTCMonth() + sign * Number(o.months);
  y += Math.floor(mo / 12);
  mo = ((mo % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  const day = Math.min(base.getUTCDate(), lastDay);
  let result = new Date(
    Date.UTC(
      y,
      mo,
      day,
      base.getUTCHours(),
      base.getUTCMinutes(),
      base.getUTCSeconds(),
      base.getUTCMilliseconds(),
    ),
  );

  // Then fixed-length units.
  const deltaMs =
    sign * (Number(o.weeks) * 7 + Number(o.days)) * 86400000 +
    sign * (Number(o.hours) * 60 + Number(o.minutes)) * 60000;
  result = new Date(result.getTime() + deltaMs);

  const dayDelta = (result.getTime() - base.getTime()) / 86400000;
  const daysLabel = `${dayDelta === 0 ? '' : dayDelta > 0 ? '+' : '-'}${trimNum(Math.abs(dayDelta))} ${Math.abs(dayDelta) === 1 ? 'day' : 'days'}`;
  const weekday = result.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

  const rows: string[][] = [
    ['ISO 8601', result.toISOString()],
    ['RFC 2822', result.toUTCString()],
    ['Weekday', weekday],
    ['Days from base', daysLabel],
  ];
  return {
    output: JSON.stringify({ headers: ['Field', 'Value'], rows }),
    render: 'table',
    stats: { result: result.toISOString().slice(0, 10) },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
