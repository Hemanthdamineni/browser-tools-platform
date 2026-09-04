import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './cron-parser.meta';
import cronstrue from 'cronstrue';

const MONTHS: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

const DOWS: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

function parseName(token: string, names: Record<string, number>): number {
  const up = token.toUpperCase();
  if (up in names) return names[up]!;
  const n = Number(token);
  if (!Number.isInteger(n)) throw new ToolError(`Invalid value in cron field: "${token}".`);
  return n;
}

/** Expand one cron field into the set of numeric values it allows. */
function parseField(
  field: string,
  min: number,
  max: number,
  names: Record<string, number> = {},
): Set<number> {
  const out = new Set<number>();
  for (const part of field.split(',')) {
    if (part === '') throw new ToolError(`Empty item in cron field: "${field}".`);

    const slash = part.split('/');
    if (slash.length > 2) throw new ToolError(`Bad step in cron field: "${part}".`);
    const rangeRaw = slash[0] ?? '';
    const stepRaw = slash.length === 2 ? slash[1]! : undefined;

    let step = 1;
    if (stepRaw !== undefined) {
      step = Number(stepRaw);
      if (!Number.isInteger(step) || step <= 0) {
        throw new ToolError(`Step must be a positive integer: "${part}".`);
      }
    }

    let lo: number;
    let hi: number;
    if (rangeRaw === '*' || rangeRaw === '') {
      lo = min;
      hi = max;
    } else if (rangeRaw.includes('-')) {
      const bounds = rangeRaw.split('-');
      if (bounds.length !== 2 || bounds[0] === '' || bounds[1] === '') {
        throw new ToolError(`Bad range in cron field: "${part}".`);
      }
      lo = parseName(bounds[0]!, names);
      hi = parseName(bounds[1]!, names);
    } else {
      lo = parseName(rangeRaw, names);
      hi = stepRaw !== undefined ? max : lo;
    }

    if (lo < min || hi > max || lo > hi) {
      throw new ToolError(`Value out of range in cron field: "${part}" (allowed ${min}-${max}).`);
    }
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return out;
}

interface DayMatchArgs {
  domSet: Set<number>;
  dowSet: Set<number>;
  domRestricted: boolean;
  dowRestricted: boolean;
}

function dayMatch(d: Date, a: DayMatchArgs): boolean {
  const domHit = a.domSet.has(d.getUTCDate());
  const dowHit = a.dowSet.has(d.getUTCDay());
  if (a.domRestricted && a.dowRestricted) return domHit || dowHit;
  if (a.domRestricted) return domHit;
  if (a.dowRestricted) return dowHit;
  return true;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);

  const expr = (input.text ?? '').trim();
  if (!expr) return { output: '' };

  const withSeconds = Boolean(o.withSeconds);
  const verbose = Boolean(o.verbose);
  let count = Math.floor(Number(o.count));
  if (!Number.isFinite(count)) count = 5;
  count = Math.max(1, Math.min(20, count));

  const parts = expr.split(/\s+/);
  if (parts.length < 5 || parts.length > 6) {
    throw new ToolError(
      'A cron expression needs 5 or 6 fields.',
      'minute hour day-of-month month day-of-week, optionally a seconds field first.',
    );
  }
  const hasSeconds = parts.length === 6;
  if (withSeconds && !hasSeconds) {
    throw new ToolError(
      '"Expression starts with a seconds field" is on, but only 5 fields were given.',
    );
  }

  let sentence: string;
  try {
    sentence = cronstrue.toString(expr, { throwExceptionOnParseError: true, verbose });
  } catch (e) {
    const msg = (e as Error | undefined)?.message;
    throw new ToolError(
      msg ? `Could not parse cron expression: ${msg}` : 'Could not parse cron expression.',
    );
  }

  const f = hasSeconds ? parts : ['0', ...parts];
  const secSet = parseField(f[0]!, 0, 59);
  const minSet = parseField(f[1]!, 0, 59);
  const hourSet = parseField(f[2]!, 0, 23);
  const domSet = parseField(f[3]!, 1, 31);
  const monSet = parseField(f[4]!, 1, 12, MONTHS);
  const rawDow = parseField(f[5]!, 0, 7, DOWS);

  const dowSet = new Set<number>();
  for (const v of rawDow) dowSet.add(v === 7 ? 0 : v);

  const dayArgs: DayMatchArgs = {
    domSet,
    dowSet,
    domRestricted: f[3]!.trim() !== '*',
    dowRestricted: f[5]!.trim() !== '*',
  };

  const secondsAsc = [...secSet].sort((a, b) => a - b);

  const matches: string[] = [];
  const d = new Date();
  d.setUTCSeconds(0, 0);
  d.setUTCMinutes(d.getUTCMinutes() + 1);

  const MAX_ITERS = 366 * 24 * 60 * 5; // ~5 years of minutes
  let iters = 0;
  while (matches.length < count && iters < MAX_ITERS) {
    iters += 1;
    if (
      minSet.has(d.getUTCMinutes()) &&
      hourSet.has(d.getUTCHours()) &&
      monSet.has(d.getUTCMonth() + 1) &&
      dayMatch(d, dayArgs)
    ) {
      for (const s of secondsAsc) {
        const hit = new Date(d);
        hit.setUTCSeconds(s, 0);
        matches.push(hit.toISOString());
        if (matches.length >= count) break;
      }
    }
    d.setUTCMinutes(d.getUTCMinutes() + 1);
  }

  if (matches.length < count) {
    throw new ToolError('Could not compute upcoming run times — this schedule may never match.');
  }

  return {
    output: [sentence, '', ...matches].join('\n'),
    stats: {
      fields: hasSeconds ? 6 : 5,
      'next runs': matches.length,
      seconds: hasSeconds ? 'yes' : 'no',
    },
    notes: [`Times are UTC, computed from this device clock at ${new Date().toISOString()}.`],
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
