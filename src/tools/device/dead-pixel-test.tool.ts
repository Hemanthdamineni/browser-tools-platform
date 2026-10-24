/**
 * Dead pixel test — the tool module.
 *
 * The panel owns the Fullscreen API and the colour cycling; it records which
 * solid colours the user actually swept and hands that session here as text.
 * This module turns it into a report (or, when the panel has not run yet,
 * the canonical test palette) so the workbench always has something to show.
 *
 * Nothing is uploaded: the session is read in this tab and the report is
 * drawn on this page.
 */
import type { OptionValues, TextRunInput, TextRunResult, TextToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { DEAD_PIXEL_SEQUENCE } from './dead-pixel-test.core';
import { meta } from './dead-pixel-test.meta';

/** The tool's input. `options` may be omitted — the declared defaults apply. */
export type DeadPixelTestInput = Omit<TextRunInput, 'options'> & {
  options?: OptionValues;
};

/** One colour shown during a test session, as the panel recorded it. */
export interface ShownColour {
  /** The colour name, matching an entry in `DEAD_PIXEL_SEQUENCE`. */
  name: string;
  /** The CSS value that was on screen. */
  value: string;
  /** How long the colour stayed up, in milliseconds. */
  shownMs: number;
  /** True when the user flagged this screen as suspect. */
  suspect?: boolean;
}

/** The session the panel hands to `run()`. */
export interface DeadPixelSession {
  /** The colours that were shown, in the order they appeared. */
  shown: ShownColour[];
  /** Whether the auto-cycle was running when the session was saved. */
  auto: boolean;
  /** Whether the user entered fullscreen for this session. */
  fullscreen: boolean;
}

/** Clamp a numeric option into a sane range. */
function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Parse the session the panel recorded. Throws a `ToolError` when it cannot. */
export function parseSession(text: string): DeadPixelSession {
  const raw = (text ?? '').trim();
  if (!raw) {
    throw new ToolError(
      'No dead-pixel sweep has been recorded yet.',
      'Run the fullscreen test and the report fills in here.',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ToolError(
      'The recorded sweep could not be read.',
      'Reload the page and run the test again.',
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ToolError(
      'The recorded sweep is not in the expected shape.',
      'Reload the page and try again.',
    );
  }

  const session = parsed as Partial<DeadPixelSession>;
  if (!Array.isArray(session.shown)) {
    throw new ToolError(
      'The recorded sweep holds no colours.',
      'Run the fullscreen test and the report appears here.',
    );
  }

  session.shown.forEach((colour, index) => {
    if (!colour || typeof colour !== 'object') {
      throw new ToolError(
        `Colour ${index + 1} of the sweep is malformed.`,
        'Reload the page and try again.',
      );
    }
    if (typeof colour.name !== 'string' || !colour.name) {
      throw new ToolError(
        `Colour ${index + 1} of the sweep has no name.`,
        'Reload the page and try again.',
      );
    }
    if (typeof colour.value !== 'string' || !colour.value) {
      throw new ToolError(
        `Colour ${index + 1} of the sweep has no value.`,
        'Reload the page and try again.',
      );
    }
  });

  return {
    shown: session.shown as ShownColour[],
    auto: session.auto === true,
    fullscreen: session.fullscreen === true,
  };
}

/** Build the report table from a recorded sweep. */
export function buildReport(session: DeadPixelSession): TextRunResult {
  const rows = session.shown.map((colour, index) => [
    String(index + 1),
    colour.name,
    colour.value,
    colour.shownMs > 0 ? `${(colour.shownMs / 1000).toFixed(1)}s` : '—',
    colour.suspect ? 'Suspect' : 'Checked',
  ]);

  const notes: string[] = [];
  notes.push(
    session.fullscreen
      ? 'Run in fullscreen on the panel — press Escape (or the browser’s own fullscreen hint) to leave.'
      : 'The sweep ran in the tab without fullscreen.',
  );
  notes.push(
    session.auto
      ? 'Auto-cycle was on, so colours advanced on the interval you set.'
      : 'Colours were stepped by hand with the arrow keys.',
  );

  const suspects = session.shown.filter((c) => c.suspect).length;
  if (suspects > 0) {
    notes.push(`You flagged ${suspects} screen${suspects === 1 ? '' : 's'} as suspect.`);
  } else {
    notes.push(
      'No screen was flagged. A clean panel is usually good news, but check the greys — stuck sub-pixels hide there.',
    );
  }

  return {
    output: JSON.stringify({
      headers: ['Step', 'Colour', 'Value', 'Shown', 'Result'],
      rows,
    }),
    render: 'table',
    stats: {
      colours: session.shown.length,
      suspects,
      auto: session.auto ? 1 : 0,
      fullscreen: session.fullscreen ? 1 : 0,
    },
    notes,
  };
}

/** The canonical palette, as colours — the fallback before a session exists. */
export function paletteResult(options: OptionValues): TextRunResult {
  const interval = clampInt(options.intervalMs, 500, 60000, 5000);
  const auto = options.autoCycle === true;

  const notes: string[] = [
    'Open the panel, go fullscreen pressing Enter, and sweep each colour with the arrow keys.',
    'Press Space to toggle the auto-cycle; press Escape to leave fullscreen.',
  ];
  notes.push(
    auto
      ? `Auto-cycle is set to advance every ${(interval / 1000).toFixed(interval % 1000 ? 1 : 0)}s.`
      : 'Auto-cycle is off — step the colours by hand.',
  );

  return {
    output: JSON.stringify(DEAD_PIXEL_SEQUENCE.map((c) => c.value)),
    render: 'colors',
    stats: { colours: DEAD_PIXEL_SEQUENCE.length },
    notes,
  };
}

/** Run the dead-pixel test. */
export function runDeadPixelTest(input: DeadPixelTestInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const text = (input.text ?? '').trim();

  if (text) {
    return buildReport(parseSession(text));
  }
  return paletteResult(o);
}

function run(input: DeadPixelTestInput): TextRunResult {
  return runDeadPixelTest(input);
}

const tool: TextToolModule = { meta, run };
export default tool;
