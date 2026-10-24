import type { TextRunInput, TextRunResult, TextToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './webcam-test.meta';
import {
  RESOLUTION_VALUES,
  buildNotes,
  buildReportRows,
  buildStats,
  fpsWarning,
  parseWebcamFacts,
  type ReportOptions,
} from './webcam-test.core';

/** The resolution the panel asked for — validated, never guessed. */
function readResolution(value: unknown): string {
  const raw = value === undefined || value === null ? 'auto' : value;
  if (typeof raw !== 'string') {
    throw new ToolError(
      'The "resolution" option must be a string.',
      `Received ${typeof raw} instead.`,
    );
  }
  if (!RESOLUTION_VALUES.includes(raw)) {
    throw new ToolError(
      `Unknown resolution "${raw}".`,
      `Choose one of: ${RESOLUTION_VALUES.join(', ')}.`,
    );
  }
  return raw;
}

/** Whether the raw track settings belong in the report. */
function readIncludeSettings(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value !== 'boolean') {
    throw new ToolError(
      'The "includeSettings" option must be true or false.',
      `Received ${typeof value} instead.`,
    );
  }
  return value;
}

/**
 * Build the webcam report from the facts the panel measured.
 *
 * The panel is the UI; the tool owns the parsing, the validation and the
 * formatting, so the same code path is used in the browser and in the tests.
 */
function run(input: TextRunInput): TextRunResult {
  const o = resolveOptions(meta, input.options);
  const facts = parseWebcamFacts(input.text);

  const options: ReportOptions = {
    requested: readResolution(o.resolution),
    includeSettings: readIncludeSettings(o.includeSettings),
  };

  const rows = buildReportRows(facts, options);
  const notes = buildNotes(facts);
  const warnings: string[] = [];

  const frameRateWarning = fpsWarning(facts);
  if (frameRateWarning) warnings.push(frameRateWarning);

  return {
    output: JSON.stringify({ headers: ['Property', 'Value'], rows }),
    render: 'table',
    stats: buildStats(facts),
    notes,
    warnings: warnings.length ? warnings : undefined,
  };
}

const tool: TextToolModule = { meta, run };
export default tool;
