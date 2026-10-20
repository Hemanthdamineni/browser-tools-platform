import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './world-clock.meta';

const MAX_ZONES = 60;

const DEFAULT_ZONES = [
  'UTC',
  'America/New_York',
  'Europe/London',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Australia/Sydney',
];

function zonedParts(zone: string, hour12: boolean): Intl.DateTimeFormatPart[] | null {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hour12,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZoneName: 'longOffset',
    }).formatToParts(new Date());
  } catch {
    return null;
  }
}

function part(parts: Intl.DateTimeFormatPart[], type: string): string {
  return (parts.find((p) => p.type === type)?.value ?? '0').trim();
}

function normalizeOffset(name: string | undefined): string {
  let value = (name ?? '').replace(/^GMT/, '').trim();
  if (!value) return '+00:00';
  // Some engines emit GMT when the offset is zero, or short forms like GMT+5:30.
  const m = /^([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(value);
  if (m) {
    const sign = m[1] === '-' ? '-' : '+';
    const hh = m[2]!.padStart(2, '0');
    const mm = m[3] ?? '00';
    return sign + hh + ':' + mm;
  }
  return value;
}

async function run(input: TextRunInput): Promise<TextRunResult> {
  const o = resolveOptions(meta, input.options);
  const hour12 = o.hour12 === true;
  const showDate = o.showDate !== false;

  const raw = (input.text ?? '').trim();
  const zones = raw
    ? raw
        .split(/[\n,]+/)
        .map((z) => z.trim())
        .filter(Boolean)
        .slice(0, MAX_ZONES)
    : DEFAULT_ZONES;

  const seen = new Set<string>();
  const rows: string[][] = [];
  const notes: string[] = [];
  const invalid: string[] = [];

  for (const zone of zones) {
    if (seen.has(zone)) continue;
    seen.add(zone);
    const partsZ = zonedParts(zone, hour12);
    if (partsZ === null) {
      invalid.push(zone);
      continue;
    }
    const hh = part(partsZ, 'hour').padStart(2, '0');
    const mm = part(partsZ, 'minute').padStart(2, '0');
    const ss = part(partsZ, 'second').padStart(2, '0');
    const time = hour12
      ? hh + ':' + mm + ':' + ss + ' ' + (part(partsZ, 'dayPeriod').toUpperCase() || '')
      : hh + ':' + mm + ':' + ss;
    const date =
      part(partsZ, 'year') +
      '-' +
      part(partsZ, 'month').padStart(2, '0') +
      '-' +
      part(partsZ, 'day').padStart(2, '0');
    const offset = normalizeOffset(part(partsZ, 'timeZoneName'));
    rows.push(showDate ? [zone, time, offset, date] : [zone, time, offset]);
  }

  if (!rows.length)
    throw new ToolError(
      'No valid time zones in the input.',
      'Use IANA names such as UTC, America/Los_Angeles.',
    );
  if (invalid.length)
    notes.push('Ignored ' + invalid.length + ' unknown time zone(s): ' + invalid.join(', ') + '.');

  const noteText = notes.length
    ? notes
    : [raw ? 'Times computed from your device clock + zone data.' : 'Using the default zone set.'];
  return {
    output: JSON.stringify({
      headers: showDate ? ['Zone', 'Time', 'Offset', 'Date'] : ['Zone', 'Time', 'Offset'],
      rows,
    }),
    render: 'table',
    stats: { zones: rows.length },
    notes: noteText,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
