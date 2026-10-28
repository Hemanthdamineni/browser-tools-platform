/**
 * The keyboard tester's report.
 */
import type { OptionValues, TextRunInput, TextRunResult, TextToolModule } from '@/lib/types';
import { meta } from './keyboard-tester.meta';
import { parseCombination, parseSession, buildReport } from './keyboard-tester.core';

/** One rollover attempt, as the panel recorded it. */
export interface GhostingAttempt {
  combination: string;
  expected: string[];
  pressed: string[];
  missing: string[];
  downTogether: string[];
  status: 'pass' | 'fail';
  notes: string;
  when: string;
}

/** The snapshot the panel hands to `run()`. */
export interface KeyboardSession {
  attempts: GhostingAttempt[];
  options: Record<string, unknown>;
}

/** The tool's input. `options` may be omitted — the declared defaults apply. */
export type KeyboardTesterInput = Omit<TextRunInput, 'options'> & {
  options?: OptionValues;
};

/** Run the keyboard tester over a recorded session. */
export function runKeyboardTester(input: KeyboardTesterInput): TextRunResult {
  const options = input.options || {};
  const session = parseSession(input.text);
  return buildReport(session, options);
}

const tool: TextToolModule = { meta, run: runKeyboardTester };
export default tool;
