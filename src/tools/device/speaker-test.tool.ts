/**
 * The speaker test report.
 *
 * The panel owns the browser APIs — it plays the tones out of the speakers and
 * records each finished play here. This module validates that log, turns it
 * into a report table and reminds the reader to keep the volume sensible.
 */
import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import {
  channelLabel,
  formatFrequency,
  frequencyToNote,
  type SpeakerChannel,
  type SpeakerMode,
} from '@/components/panels/speaker-test-panel';
import { meta } from './speaker-test.meta';

const HEADERS = ['Test', 'Channel', 'Frequency', 'Note', 'Duration', 'When (UTC)'];

/** The tool's input. `options` may be omitted — the declared defaults apply. */
export type SpeakerTestInput = Omit<TextRunInput, 'options'> & {
  options?: Record<string, string | number | boolean>;
};

/** One play as the report table reads it. */
export interface SpeakerPlayEntry {
  channel: SpeakerChannel;
  mode: SpeakerMode;
  frequency: number;
  sweepEnd: number;
  durationMs: number;
  at: string;
}

/** Pull the clock time out of an ISO timestamp without the user's locale. */
function formatTimestamp(iso: string): string {
  const match = /^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2}:\d{2})/.exec(iso ?? '');
  return match?.[1] ?? '';
}

/** Parse the session the panel produced. Throws a `ToolError` when it cannot. */
export function parseSession(text: string): { plays: SpeakerPlayEntry[] } {
  const raw = (text ?? '').trim();
  if (!raw) {
    throw new ToolError(
      'No plays have been recorded yet.',
      'Press Play on the panel above and the report fills in.',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ToolError('The recorded plays could not be read.', 'Reload the page and try again.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ToolError(
      'The recorded plays are not in the expected shape.',
      'Reload the page and try again.',
    );
  }

  const session = parsed as { plays?: unknown };
  if (!Array.isArray(session.plays)) {
    throw new ToolError(
      'The recorded session holds no plays.',
      'Press Play and the report appears here.',
    );
  }

  const plays = session.plays.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new ToolError(`Play ${index + 1} is malformed.`, 'Reload the page and try again.');
    }
    const p = entry as Record<string, unknown>;
    const channel = String(p.channel ?? '');
    if (channel !== 'left' && channel !== 'right' && channel !== 'both') {
      throw new ToolError(
        `Play ${index + 1} has an unknown channel.`,
        'Reload the page and try again.',
      );
    }
    const mode = String(p.mode ?? '');
    if (mode !== 'tone' && mode !== 'sweep') {
      throw new ToolError(
        `Play ${index + 1} has an unknown mode.`,
        'Reload the page and try again.',
      );
    }
    return {
      channel: channel as SpeakerChannel,
      mode: mode as SpeakerMode,
      frequency: Number(p.frequency) || 0,
      sweepEnd: Number(p.sweepEnd) || 0,
      durationMs: Number(p.durationMs) || 0,
      at: String(p.at ?? ''),
    };
  });

  return { plays };
}

/** Build the report table from a recorded session. */
export function buildReport(
  session: { plays: SpeakerPlayEntry[] },
  options: Record<string, string | number | boolean>,
): {
  output: string;
  stats: Record<string, string | number>;
  notes: string[];
  warnings: string[];
} {
  const includeTimestamps = options.includeTimestamps !== false;
  const plays = session.plays;
  const headers = includeTimestamps ? [...HEADERS] : HEADERS.slice(0, -1);

  const rows: string[][] = [];
  for (const play of plays) {
    const label =
      play.mode === 'sweep'
        ? `Sweep ${formatFrequency(play.frequency)} → ${formatFrequency(play.sweepEnd)}`
        : `Tone ${formatFrequency(play.frequency)}`;
    const row = [
      label,
      channelLabel(play.channel),
      play.mode === 'sweep'
        ? `${formatFrequency(play.frequency)} – ${formatFrequency(play.sweepEnd)}`
        : formatFrequency(play.frequency),
      play.mode === 'sweep' ? '—' : frequencyToNote(play.frequency),
      `${(play.durationMs / 1000).toFixed(play.durationMs % 1000 === 0 ? 0 : 1)} s`,
    ];
    if (includeTimestamps) row.push(formatTimestamp(play.at));
    rows.push(row);
  }

  const notes: string[] = [];
  const warnings: string[] = [];

  if (!plays.length) {
    notes.push('No plays yet — press Play on the panel above.');
  } else {
    const last = plays[plays.length - 1]!;
    const lastLabel =
      last.mode === 'sweep'
        ? `Sweep ${formatFrequency(last.frequency)} → ${formatFrequency(last.sweepEnd)}`
        : `Tone ${formatFrequency(last.frequency)} (${frequencyToNote(last.frequency)})`;
    notes.push(`Last play: ${lastLabel} out of the ${channelLabel(last.channel)} channel.`);
  }

  // The one warning that matters — a loud test tone is uncomfortable at best.
  warnings.push(
    'Tones can be loud. Start at a low volume and raise it slowly; stop if you hear distortion or discomfort.',
  );

  return {
    output: JSON.stringify({ headers, rows }),
    stats: {
      plays: plays.length,
      lastChannel: plays.length ? channelLabel(plays[plays.length - 1]!.channel) : '—',
      lastDurationMs: plays.length ? plays[plays.length - 1]!.durationMs : 0,
    },
    notes,
    warnings,
  };
}

/** Run the speaker test over a recorded session. */
export function runSpeakerTest(input: SpeakerTestInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const session = parseSession(input.text);
  const report = buildReport(session, o);
  return {
    output: report.output,
    render: 'table',
    stats: report.stats,
    notes: report.notes,
    warnings: report.warnings.length ? report.warnings : undefined,
  };
}

function run(input: SpeakerTestInput): TextRunResult {
  return runSpeakerTest(input);
}

const tool: TextToolModule = { meta, run };
export default tool;
