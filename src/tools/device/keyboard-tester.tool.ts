/**
 * The keyboard tester's report.
 *
 * The panel owns the browser APIs — it listens for key events, keeps the set
 * of keys that are down and hands a snapshot of the session to this module.
 * Everything that is worth testing (deciding whether a rollover attempt
 * passed, formatting the combination, building the report table) lives in
 * `keyboard-tester.core.ts` and is pure.
 */
import type { OptionValues, TextRunInput, TextRunResult, TextToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import {
  describeEvent,
  evaluateGhosting,
  formatCombination,
  type KeyEventLike,
} from './keyboard-tester.core';
import { meta } from './keyboard-tester.meta';

/** One rollover attempt, as the panel recorded it. */
export interface GhostingAttempt {
  /** The combination the user was asked to press. */
  expected: string[];
  /** The keys that were down at the same moment at the best point. */
  pressed: string[];
  /** ISO timestamp of the attempt. */
  at: string;
}

/** The snapshot the panel hands to `run()`. */
export interface KeyboardSession {
  /** Every rollover attempt so far, oldest first. */
  attempts: GhostingAttempt[];
  /** The most recent key events, oldest first. */
  events?: KeyEventLike[];
  /** The keys that are down at the moment of the snapshot. */
  pressed?: string[];
}

/** The tool's input. `options` may be omitted — the declared defaults apply. */
export type KeyboardTesterInput = Omit<TextRunInput, 'options'> & {
  options?: OptionValues;
};

const HEADERS = ['Combination', 'Result', 'Missing', 'Down together', 'When (UTC)'];

/** Clamp a numeric option into a sane range. */
function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Pull the clock time out of an ISO timestamp without pulling in the user's
 * locale or time zone — the report reads the same everywhere.
 */
export function formatTimestamp(iso: string): string {
  const match = /^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2}:\d{2})/.exec(iso ?? '');
  return match?.[1] ?? '';
}

/** Parse the snapshot the panel produced. Throws a `ToolError` when it cannot. */
export function parseSession(text: string): KeyboardSession {
  const raw = (text ?? '').trim();
  if (!raw) {
    throw new ToolError(
      'No key events have been recorded yet.',
      'Press a key on the layout above — the report fills in as you type.',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ToolError(
      'The recorded key events could not be read.',
      'Reload the page and try again.',
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ToolError(
      'The recorded key events are not in the expected shape.',
      'Reload the page and try again.',
    );
  }

  const session = parsed as Partial<KeyboardSession>;
  if (!Array.isArray(session.attempts)) {
    throw new ToolError(
      'The recorded session holds no rollover attempts.',
      'Run the rollover test and the report appears here.',
    );
  }

  session.attempts.forEach((attempt, index) => {
    if (!attempt || typeof attempt !== 'object') {
      throw new ToolError(
        `Rollover attempt ${index + 1} is malformed.`,
        'Reload the page and try again.',
      );
    }
    if (!Array.isArray(attempt.expected) || attempt.expected.length === 0) {
      throw new ToolError(
        `Rollover attempt ${index + 1} is malformed.`,
        'Reload the page and try again.',
      );
    }
    if (!Array.isArray(attempt.pressed)) {
      throw new ToolError(
        `Rollover attempt ${index + 1} is malformed.`,
        'Reload the page and try again.',
      );
    }
  });

  if (session.events !== undefined && !Array.isArray(session.events)) {
    throw new ToolError(
      'The recorded key events are not in the expected shape.',
      'Reload the page and try again.',
    );
  }

  return {
    attempts: session.attempts,
    events: session.events ?? [],
    pressed: Array.isArray(session.pressed) ? session.pressed : [],
  };
}

/**
 * Build the rollover report from a recorded session.
 */
export function buildReport(
  session: KeyboardSession,
  options: OptionValues,
): {
  output: string;
  stats: Record<string, string | number>;
  notes: string[];
  warnings: string[];
} {
  const historySize = clampInt(options.historySize, 1, 50, 10);
  const includeTimestamps = options.includeTimestamps !== false;
  const windowMs = clampInt(options.rolloverWindowMs, 200, 5000, 1200);

  const attempts = session.attempts.slice(-historySize);
  const headers = includeTimestamps ? [...HEADERS] : HEADERS.slice(0, -1);
  const rows: string[][] = [];
  let passed = 0;
  let failed = 0;
  let best = 0;

  for (const attempt of attempts) {
    const result = evaluateGhosting(attempt.expected, attempt.pressed);
    if (result.pass) passed += 1;
    else failed += 1;
    best = Math.max(best, result.pressed.length);
    const row = [
      formatCombination(result.expected),
      result.pass ? 'PASS' : 'FAIL',
      result.missing.length ? formatCombination(result.missing) : '—',
      result.pressed.length ? formatCombination(result.pressed) : '—',
    ];
    if (includeTimestamps) row.push(formatTimestamp(attempt.at));
    rows.push(row);
  }

  const notes: string[] = [];
  const warnings: string[] = [];

  if (!attempts.length) {
    notes.push('No rollover attempts yet — start the test, then press the keys at the same time.');
  } else {
    notes.push('A pass means every key of the combination was down at the same moment.');
  }

  if (failed > 0) {
    warnings.push(
      'A failed combination can come from the keyboard, the operating system’s key filter or the browser — not from this page.',
    );
  }

  const last = session.events?.[session.events.length - 1];
  if (last) {
    const description = describeEvent(last);
    notes.push(
      `Last key: ${description.key || '—'} (${description.code || '—'}) — ${description.combo || '—'}, repeat: ${description.repeat ? 'yes' : 'no'}.`,
    );
  }

  // A short key log, so the reader can see what the browser actually got.
  const recent = (session.events ?? []).slice(-8);
  if (recent.length > 1) {
    notes.push(
      `Recent keys: ${recent
        .map((event) => `${event.key || '—'} (${event.code || '—'})`)
        .join(' → ')}.`,
    );
  }

  return {
    output: JSON.stringify({ headers, rows }),
    stats: {
      attempts: attempts.length,
      passed,
      failed,
      bestRollover: best,
      rolloverWindowMs: windowMs,
    },
    notes,
    warnings,
  };
}

/** Run the keyboard tester over a recorded session. */
export function runKeyboardTester(input: KeyboardTesterInput): TextRunResult {
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

function run(input: KeyboardTesterInput): TextRunResult {
  return runKeyboardTester(input);
}

const tool: TextToolModule = { meta, run };
export default tool;
