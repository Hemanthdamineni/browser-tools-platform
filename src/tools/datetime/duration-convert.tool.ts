import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './duration-convert.meta';

const BAD = 'Could not read that duration.';
const HINT = 'Try 1h 30m, PT1H30M, or 01:30:00';

const UNIT_SECONDS: Record<string, number> = {
  w: 604800,
  week: 604800,
  weeks: 604800,
  d: 86400,
  day: 86400,
  days: 86400,
  h: 3600,
  hr: 3600,
  hrs: 3600,
  hour: 3600,
  hours: 3600,
  m: 60,
  min: 60,
  mins: 60,
  minute: 60,
  minutes: 60,
  s: 1,
  sec: 1,
  secs: 1,
  second: 1,
  seconds: 1,
};

const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
const trimNum = (n: number): string =>
  Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));

function parseDuration(text: string): number {
  // ISO 8601: PnYnMnWnDTnHnMnS
  const iso = text.match(
    /^P(?!$)(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?=\d)(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i,
  );
  if (iso) {
    const [y, mo, w, d, h, mi, s] = iso.slice(1).map((g) => Number(g ?? 0));
    return y! * 31536000 + mo! * 2592000 + w! * 604800 + d! * 86400 + h! * 3600 + mi! * 60 + s!;
  }

  // Clock: HH:MM:SS or MM:SS
  const clock = text.match(/^(\d+):([0-5]?\d)(?::([0-5]?\d(?:\.\d+)?))?$/);
  if (clock) {
    const a = Number(clock[1]!);
    const b = Number(clock[2]!);
    const c = Number(clock[3] ?? 0);
    return clock[3] !== undefined ? a * 3600 + b * 60 + c : a * 60 + b;
  }

  // Human: 1d 2h 3m 4s, "1 hour 2 minutes", 90m
  const stripped = text.replace(/\s+/g, ' ').trim();
  let total = 0;
  let matched = false;
  const tokenRe = /(\d+(?:\.\d+)?)\s*([a-zA-Z]+)\s*/g;
  const rest = stripped.replace(tokenRe, (all, num: string, unit: string) => {
    const key = unit.toLowerCase();
    const factor = UNIT_SECONDS[key];
    if (factor === undefined) return all; // leave unknown tokens in the string
    matched = true;
    total += Number(num) * factor;
    return '';
  });
  if (matched && rest.trim() === '') return total;

  throw new ToolError(BAD, HINT);
}

function human(total: number): string {
  const sign = total < 0 ? '-' : '';
  let t = Math.abs(total);
  const parts: string[] = [];
  const units: [number, string][] = [
    [86400, 'd'],
    [3600, 'h'],
    [60, 'm'],
    [1, 's'],
  ];
  for (const [secs, suffix] of units) {
    const n = Math.floor(t / secs);
    if (n > 0) parts.push(`${n}${suffix}`);
    t -= n * secs;
  }
  if (parts.length === 0) parts.push('0s');
  if (t > 0) parts.push(`${trimNum(Number(t.toFixed(4)))}s`);
  return sign + parts.join(' ');
}

function iso8601(total: number): string {
  const sign = total < 0 ? '-' : '';
  const t = Math.abs(total);
  const d = Math.floor(t / 86400);
  const h = Math.floor((t % 86400) / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  let out = 'P';
  if (d) out += `${d}D`;
  const time: string[] = [];
  if (h) time.push(`${h}H`);
  if (m) time.push(`${m}M`);
  if (s) time.push(`${trimNum(Number(s.toFixed(4)))}S`);
  if (time.length) out += `T${time.join('')}`;
  if (out === 'P') out += 'T0S';
  return sign + out;
}

function clock(total: number): string {
  const sign = total < 0 ? '-' : '';
  const t = Math.abs(total);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  return `${sign}${pad(h)}:${pad(m)}:${pad(s)}`;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const text = input.text.trim();
  if (!text) return { output: '' };

  const mode = String(o.mode);
  let total: number;
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    total = Number(text);
  } else if (mode === 'from-seconds') {
    throw new ToolError('Enter a number of seconds.', HINT);
  } else {
    total = parseDuration(text);
  }

  const comps = `${Math.floor(Math.abs(total) / 86400)} days, ${Math.floor((Math.abs(total) % 86400) / 3600)} hours, ${Math.floor(
    (Math.abs(total) % 3600) / 60,
  )} minutes, ${Math.floor(Math.abs(total) % 60)} seconds`;

  const out = String(o.output);
  if (out === 'human') return { output: human(total) };
  if (out === 'iso8601') return { output: iso8601(total) };
  if (out === 'clock') return { output: clock(total) };
  if (out === 'seconds') return { output: trimNum(total) };
  if (out === 'components') return { output: comps };

  const rows: string[][] = [
    ['Human', human(total)],
    ['ISO 8601', iso8601(total)],
    ['Clock (HH:MM:SS)', clock(total)],
    ['Total seconds', trimNum(total)],
    ['Components', comps],
  ];
  return { output: JSON.stringify({ headers: ['Format', 'Value'], rows }), render: 'table' };
}

const tool: TextToolModule = { meta, run };
export default tool;
