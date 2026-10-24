/**
 * The tuner report.
 *
 * The panel owns the browser APIs — it opens the microphone, drives the
 * analyser and draws the needle — and hands the captured readings to this
 * module, which turns them into the note table shown under the panel. All the
 * pitch detection, note mapping and cents math lives in `tuner-panel.ts` so
 * the report and the live needle agree exactly.
 */
import type { TextToolModule, TextRunInput, TextRunResult } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { runTuner } from '@/components/panels/tuner-panel';
import { meta } from './tuner.meta';

/** Build the note report for the readings the panel (or the user) sends. */
function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  return runTuner(input.text, o);
}

const tool: TextToolModule = { meta, run };
export default tool;
