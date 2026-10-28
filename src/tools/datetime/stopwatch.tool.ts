import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './stopwatch.meta';
import {
  emptyState,
  elapsedMs,
  parseActions,
  replay,
  formatElapsed,
  type Precision,
} from './stopwatch.core';

export {
  emptyState,
  elapsedMs,
  addLap,
  applyAction,
  parseClockTime,
  parseActions,
  replay,
  formatElapsed,
  type Action,
  type ActionKind,
  type Lap,
  type Precision,
  type ReplayResult,
  type StopwatchState,
} from './stopwatch.core';

/* -------------------------------------------------------------------------- */
/*  Keyboard shortcuts — browser-only helper                                   */
/* -------------------------------------------------------------------------- */

export interface StopwatchHooks {
  toggle(): void;
  lap(): void;
  reset(): void;
}

/**
 * Global key handler: Space toggles, L laps, R resets. Ignored while the user
 * types in an input/textarea/contenteditable or holds a modifier, so text
 * entry and browser shortcuts keep working. Returns a detach function.
 */
export function bindShortcuts(root: Document, hooks: StopwatchHooks): () => void {
  const onKey = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const target = e.target;
    if (target instanceof HTMLElement) {
      const tag = target.tagName;
      const editable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        target.isContentEditable === true ||
        target.getAttribute('contenteditable') === 'true';
      if (editable) return;
    }
    switch (e.key) {
      case ' ':
        e.preventDefault();
        hooks.toggle();
        break;
      case 'l':
      case 'L':
        hooks.lap();
        break;
      case 'r':
      case 'R':
        hooks.reset();
        break;
      default:
        break;
    }
  };
  root.addEventListener('keydown', onKey);
  return () => root.removeEventListener('keydown', onKey);
}

/* -------------------------------------------------------------------------- */
/*  run() — replays an action log and reports the final state                  */
/* -------------------------------------------------------------------------- */

const BAD = 'Could not read that stopwatch log.';
const HINT =
  'One action per line, e.g. "start 10:00:00", "lap 10:00:15.25", "pause 10:00:40", "reset".';

const PRECISIONS: Precision[] = ['seconds', 'centis', 'millis'];

function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const text = input.text.trim();
  if (!text) return { output: '' };

  const precision = PRECISIONS.includes(String(o.precision) as Precision)
    ? (String(o.precision) as Precision)
    : 'centis';

  const now = Date.now();
  let actions;
  try {
    actions = parseActions(text, now);
  } catch (e) {
    throw new ToolError(e instanceof Error ? e.message : BAD, HINT);
  }
  if (actions.length === 0) {
    throw new ToolError('No stopwatch actions found.', HINT);
  }

  let result;
  try {
    result = replay(actions);
  } catch (e) {
    throw new ToolError(e instanceof Error ? e.message : BAD, HINT);
  }

  const { state, finalElapsedMs, laps } = result;
  const headers = ['Lap', 'Split', 'Total'];
  const rows = laps.map((l) => [
    String(l.index),
    formatElapsed(l.splitMs, precision),
    formatElapsed(l.totalMs, precision),
  ]);

  const notes = [
    state.running
      ? 'Running — elapsed is recomputed from Date.now() timestamps on every tick, so a throttled or sleeping tab cannot cause drift.'
      : 'Paused/stopped.',
  ];
  if (laps.length > 1) {
    const best = laps.reduce((a, b) => (b.splitMs < a.splitMs ? b : a));
    notes.push(`Fastest lap: #${best.index} (${formatElapsed(best.splitMs, precision)}).`);
  }

  const stats: Record<string, string | number> = {
    Actions: actions.length,
    Elapsed: formatElapsed(finalElapsedMs, precision),
    Laps: laps.length,
    State: state.running ? 'running' : finalElapsedMs > 0 || laps.length > 0 ? 'paused' : 'reset',
  };

  return {
    output: JSON.stringify({ headers, rows }),
    render: laps.length > 0 ? 'table' : undefined,
    notes,
    stats,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
