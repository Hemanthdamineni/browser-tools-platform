import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './crontab-generator.meta';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON_INDEX: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

/** Validate a single cron field; returns '' when valid, else an error message. */
function validateField(field: string, label: string, min: number, max: number): string {
  if (field === '') return label + ' is empty.';
  const parts = field.split(',');
  for (const raw of parts) {
    const part = raw.trim();
    if (part === '') return label + ' has an empty list item.';
    let base = part;
    if (part.includes('/')) {
      const slash = part.split('/');
      if (slash.length !== 2 || !/^[0-9]+$/.test(slash[1]!)) {
        return label + ' step must be a number: "' + part + '".';
      }
      if (Number(slash[1]) === 0) return label + ' step cannot be zero: "' + part + '".';
      base = slash[0]!;
    }
    if (base === '*') continue;
    const range = /^([A-Za-z0-9]{1,7})(?:-([A-Za-z0-9]{1,7}))?$/.exec(base);
    if (!range) {
      return label + ' has an invalid item "' + part + '".';
    }
    const toNum = (v: string): number => {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
      const mono = MON_INDEX[v.toUpperCase()];
      if (mono !== undefined) return mono;
      const dow: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
      return dow[v.toUpperCase()] ?? NaN;
    };
    const a = toNum(range[1]!);
    if (!Number.isFinite(a)) return label + ' has an unknown name "' + range[1] + '".';
    if (a < min || a > max) return label + ' value ' + a + ' is outside ' + min + '–' + max + '.';
    if (range[2] !== undefined) {
      const b = toNum(range[2]);
      if (!Number.isFinite(b)) return label + ' has an unknown name "' + range[2] + '".';
      if (b < min || b > max) return label + ' value ' + b + ' is outside ' + min + '–' + max + '.';
      if (b < a) return label + ' range "' + part + '" goes backwards.';
    }
  }
  return '';
}

/** Expand a preset into the five cron fields. */
function presetFields(
  preset: string,
  hour: number,
  minute: number,
  dayOfWeek: string,
  dayOfMonth: number,
  raw: Record<string, string>,
): { m: string; h: string; dom: string; mon: string; dow: string } {
  if (preset === 'custom') {
    return {
      m: raw.minuteField || '*',
      h: raw.hourField || '*',
      dom: raw.dayOfMonthField || '*',
      mon: raw.monthField || '*',
      dow: raw.dayOfWeekField || '*',
    };
  }
  const m = String(minute);
  const h = String(hour);
  const dom = String(dayOfMonth);
  switch (preset) {
    case 'every-5-minutes':
      return { m: '*/5', h: '*', dom: '*', mon: '*', dow: '*' };
    case 'every-15-minutes':
      return { m: '*/15', h: '*', dom: '*', mon: '*', dow: '*' };
    case 'hourly':
      return { m, h: '*', dom: '*', mon: '*', dow: '*' };
    case 'daily':
      return { m, h, dom: '*', mon: '*', dow: '*' };
    case 'weekly':
      return { m, h, dom: '*', mon: '*', dow: dayOfWeek };
    case 'monthly':
      return { m, h, dom, mon: '*', dow: '*' };
    default:
      return { m: '*', h: '*', dom: '*', mon: '*', dow: '*' };
  }
}

function summarize(f: { m: string; h: string; dom: string; mon: string; dow: string }): string {
  const pad = (n: string) => n.padStart(2, '0');
  if (f.m === '*' && f.h === '*' && f.dom === '*' && f.mon === '*' && f.dow === '*') {
    return 'Runs every minute.';
  }
  if (f.h === '*' && f.dom === '*' && f.mon === '*' && f.dow === '*' && f.m !== '*') {
    return 'Runs at minute ' + f.m + ' past every hour.';
  }
  if (f.dom === '*' && f.dow === '*' && f.mon === '*') {
    return 'Runs daily at ' + pad(f.h) + ':' + pad(f.m) + '.';
  }
  if (f.dom === '*' && f.mon === '*') {
    const dow = Number(f.dow) % 7;
    return 'Runs every ' + DAYS[dow] + ' at ' + pad(f.h) + ':' + pad(f.m) + '.';
  }
  if (f.dow === '*' && f.mon === '*') {
    return 'Runs monthly on day ' + f.dom + ' at ' + pad(f.h) + ':' + pad(f.m) + '.';
  }
  return 'Runs on a custom schedule.';
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const preset = String(o.preset ?? 'every-minute');
  const hour = Number(o.hour ?? 9);
  const minute = Number(o.minute ?? 0);
  const dayOfWeek = String(o.dayOfWeek ?? '1');
  const dayOfMonth = Number(o.dayOfMonth ?? 1);
  const command = String(o.command ?? '').trim();
  const raw = {
    minuteField: String(o.minuteField ?? ''),
    hourField: String(o.hourField ?? ''),
    dayOfMonthField: String(o.dayOfMonthField ?? ''),
    monthField: String(o.monthField ?? ''),
    dayOfWeekField: String(o.dayOfWeekField ?? ''),
  };

  const f = presetFields(preset, hour, minute, dayOfWeek, dayOfMonth, raw);

  const errors = [
    validateField(f.m, 'Minute', 0, 59),
    validateField(f.h, 'Hour', 0, 23),
    validateField(f.dom, 'Day of month', 1, 31),
    validateField(f.mon, 'Month', 1, 12),
    validateField(f.dow, 'Day of week', 0, 6),
  ].filter((e) => e !== '');
  if (errors.length > 0) {
    throw new ToolError(errors.join(' '), 'Fix the invalid field, or use a preset.');
  }

  const expression = f.m + ' ' + f.h + ' ' + f.dom + ' ' + f.mon + ' ' + f.dow;
  const line = command ? expression + ' ' + command : expression;

  return {
    output: line + '\n',
    render: 'text',
    language: 'text',
    stats: { fields: 5, hasCommand: command ? 1 : 0 },
    notes: [summarize(f), command ? 'Command appended to the crontab line.' : 'Expression only — add a command if needed.'],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
