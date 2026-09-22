import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './timezone-convert.meta';

const ZONES: [string, string][] = [
  ['UTC', 'UTC'],
  ['America/New_York', 'New York'],
  ['America/Chicago', 'Chicago'],
  ['America/Denver', 'Denver'],
  ['America/Los_Angeles', 'Los Angeles'],
  ['America/Sao_Paulo', 'São Paulo'],
  ['Europe/London', 'London'],
  ['Europe/Paris', 'Paris'],
  ['Europe/Berlin', 'Berlin'],
  ['Europe/Moscow', 'Moscow'],
  ['Africa/Cairo', 'Cairo'],
  ['Africa/Johannesburg', 'Johannesburg'],
  ['Asia/Kolkata', 'Kolkata'],
  ['Asia/Dubai', 'Dubai'],
  ['Asia/Karachi', 'Karachi'],
  ['Asia/Dhaka', 'Dhaka'],
  ['Asia/Bangkok', 'Bangkok'],
  ['Asia/Singapore', 'Singapore'],
  ['Asia/Shanghai', 'Shanghai'],
  ['Asia/Tokyo', 'Tokyo'],
  ['Asia/Seoul', 'Seoul'],
  ['Australia/Perth', 'Perth'],
  ['Australia/Sydney', 'Sydney'],
  ['Pacific/Auckland', 'Auckland'],
  ['Pacific/Honolulu', 'Honolulu'],
];

const TARGETS: Record<string, string[]> = {
  us: [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'Pacific/Honolulu',
    'UTC',
  ],
  europe: [
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Moscow',
    'Europe/Madrid',
    'Europe/Rome',
    'Europe/Stockholm',
    'UTC',
  ],
  asia: [
    'Asia/Kolkata',
    'Asia/Dubai',
    'Asia/Shanghai',
    'Asia/Tokyo',
    'Asia/Seoul',
    'Asia/Singapore',
    'Asia/Bangkok',
    'UTC',
  ],
  world: ZONES.map(([z]) => z),
};

const labelOf = (zone: string): string => ZONES.find(([z]) => z === zone)?.[0] ?? zone;

/** Offset (ms) of `zone` at the given UTC instant. */
function zoneOffsetMs(instantMs: number, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instantMs));
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - instantMs;
}

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const text = input.text.trim();
  const fromZone = String(o.fromZone);
  const targetList = TARGETS[String(o.targets)] ?? TARGETS['world']!;

  let instant: number;
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const wall = Date.UTC(
      Number(m[1]!),
      Number(m[2]!) - 1,
      Number(m[3]!),
      Number(m[4] ?? 0),
      Number(m[5] ?? 0),
      Number(m[6] ?? 0),
    );
    instant = wall - zoneOffsetMs(wall, fromZone);
  } else if (!text) {
    instant = Date.now();
  } else {
    const d = new Date(text);
    if (isNaN(d.getTime()))
      throw new ToolError('That is not a valid date and time.', 'Try 2024-01-15 12:00.');
    instant = d.getTime();
  }

  const fmt = (zone: string): string =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'shortOffset',
    }).format(new Date(instant));

  const rows = targetList.map((zone) => [labelOf(zone), fmt(zone)]);
  return {
    output: JSON.stringify({ headers: ['Zone', 'Local time'], rows }),
    render: 'table',
    stats: { zones: rows.length },
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
