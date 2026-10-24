/**
 * The stopwatch report.
 *
 * The panel owns the browser APIs — the live readout, the laps and the
 * keyboard shortcuts. It hands a snapshot of the watch to this module, which
 * turns it into the lap table shown under the panel. All the timestamp maths
 * (elapsed time, lap splits, fastest/slowest, `HH:MM:SS.mmm` formatting) lives
 * in `stopwatch-panel.ts` so the panel and the report agree exactly.
 */
import type { TextRunInput, TextRunResult, TextToolModule } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { runStopwatch } from '@/components/panels/stopwatch-panel';
import { meta } from './stopwatch.meta';

/** Build the lap report for the snapshot the panel sends. */
function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  return runStopwatch(input.text, o);
}

const tool: TextToolModule = { meta, run };
export default tool;
