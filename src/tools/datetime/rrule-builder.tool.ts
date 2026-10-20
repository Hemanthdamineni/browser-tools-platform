import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './rrule-builder.meta';

const DAYS: Record<string, string> = {
  MO: 'Monday',
  TU: 'Tuesday',
  WE: 'Wednesday',
  TH: 'Thursday',
  FR: 'Friday',
  SA: 'Saturday',
  SU: 'Sunday',
};
const ORDER = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const FREQ_LABELS: Record<string, string> = {
  DAILY: 'day',
  WEEKLY: 'week',
  MONTHLY: 'month',
  YEARLY: 'year',
};

function dateValue(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ToolError('Enter the end date as YYYY-MM-DD.');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new ToolError('Enter a real calendar date for the rule end.');
  }
  return `${value.replace(/-/g, '')}T235959Z`;
}

function run(input: TextRunInput): TextRunResult {
  const options = resolveOptions(meta, input.options);
  const frequency = String(options.frequency);
  if (!Object.prototype.hasOwnProperty.call(FREQ_LABELS, frequency))
    throw new ToolError('Choose a valid recurrence frequency.');

  const interval = Number(options.interval);
  if (!Number.isInteger(interval) || interval < 1 || interval > 999)
    throw new ToolError('Repeat interval must be a whole number from 1 to 999.');
  const count = Number(options.count);
  if (!Number.isInteger(count) || count < 0 || count > 9999)
    throw new ToolError('Occurrence count must be a whole number from 0 to 9999.');
  const untilText = String(options.until ?? '').trim();
  if (count > 0 && untilText)
    throw new ToolError('Use either an occurrence count or an end date, not both.');

  const parts = [`FREQ=${frequency}`];
  if (interval !== 1) parts.push(`INTERVAL=${interval}`);
  const notes: string[] = [];
  let description = `Repeats every ${interval === 1 ? '' : `${interval} `}${FREQ_LABELS[frequency]}`;

  if (frequency === 'WEEKLY') {
    const rawDays = String(options.weekdays ?? '').trim();
    if (rawDays) {
      const days = rawDays
        .toUpperCase()
        .split(/[\s,]+/)
        .filter(Boolean);
      if (!days.length || days.some((day) => !(day in DAYS))) {
        throw new ToolError('Use weekday codes MO, TU, WE, TH, FR, SA, or SU.');
      }
      if (new Set(days).size !== days.length) throw new ToolError('List each weekday only once.');
      const ordered = ORDER.filter((day) => days.includes(day));
      parts.push(`BYDAY=${ordered.join(',')}`);
      description += ` on ${ordered.map((day) => DAYS[day]).join(', ')}`;
    } else {
      notes.push('No BYDAY selected; the event repeats on the weekday of DTSTART.');
      description += ' on the weekday of DTSTART';
    }
  } else if (String(options.weekdays ?? '').trim()) {
    throw new ToolError('Weekday selection is only available for weekly rules.');
  }

  if (frequency === 'MONTHLY') {
    const monthDay = Number(options.monthDay);
    if (!Number.isInteger(monthDay) || monthDay < 1 || monthDay > 31) {
      throw new ToolError('Day of month must be a whole number from 1 to 31.');
    }
    parts.push(`BYMONTHDAY=${monthDay}`);
    description += ` on day ${monthDay}`;
    if (monthDay >= 29)
      notes.push(
        'Months without this day do not produce an occurrence under the standard recurrence rule.',
      );
  }

  if (count > 0) {
    parts.push(`COUNT=${count}`);
    description += `, ${count} occurrence${count === 1 ? '' : 's'}`;
  }
  if (untilText) {
    const until = dateValue(untilText);
    parts.push(`UNTIL=${until}`);
    description += `, through ${untilText}`;
    notes.push('UNTIL is emitted as a UTC date-time at the final second of the selected date.');
  }

  return {
    output: `RRULE:${parts.join(';')}`,
    render: 'code',
    language: 'text',
    filename: 'recurrence-rule.txt',
    stats: { frequency, interval, 'rule parts': parts.length },
    notes: [description, ...notes],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
