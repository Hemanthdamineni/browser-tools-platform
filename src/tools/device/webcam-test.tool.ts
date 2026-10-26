/**
 * Webcam Test.
 *
 * The camera panel does the live work (device picker, preview, frame-rate
 * measurement, snapshot); this module turns the captured frame plus the panel's
 * readings into a report and a downloadable PNG. It stays pure — no DOM, no
 * `navigator`, no camera — so the whole of it runs in a Web Worker and in a test.
 */
import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './webcam-test.meta';
import {
  assertSnapshotDimensions,
  buildReportNotes,
  buildReportRows,
  formatFps,
  formatResolution,
  parseCaptureProbe,
  readImageDimensions,
  snapshotFilename,
  type SnapshotFormat,
} from './webcam-test.core';

const MIME: Record<SnapshotFormat, string> = { png: 'image/png', jpeg: 'image/jpeg' };

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const files = (input.files ?? []).filter(Boolean);

  if (!files.length) {
    throw new ToolError(
      'Take a snapshot first.',
      'Press “Start camera” in the panel above, then “Take snapshot”.',
    );
  }
  if (files.length > 1) {
    throw new ToolError(
      'One snapshot at a time.',
      'The webcam test reports a single frame per run.',
    );
  }

  const file = files[0]!;
  if (file.size === 0) {
    throw new ToolError(`“${file.name}” is empty.`, 'Take the snapshot again from the panel.');
  }
  input.signal?.throwIfAborted?.();

  // A malformed reading probe is a user-facing error rather than a silent,
  // half-empty report.
  const probe = parseCaptureProbe(o.capture);

  input.onProgress?.(0, 'Reading the snapshot');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const dimensions = readImageDimensions(bytes);
  if (!dimensions) {
    throw new ToolError(
      `“${file.name}” is not a PNG or JPEG image.`,
      'This tool reports the frame the camera panel captures; PNG and JPEG are the formats it can measure.',
    );
  }
  assertSnapshotDimensions(dimensions.width, dimensions.height);

  input.onProgress?.(0.5, 'Building the report');
  const snapshot = { ...dimensions, bytes: bytes.length };
  const rows = buildReportRows(probe, snapshot);
  const { notes, warnings } = buildReportNotes(probe, snapshot);

  input.onProgress?.(1, 'Done');
  return {
    outputs: [
      {
        filename: snapshotFilename(probe.deviceLabel, new Date(), dimensions.format),
        blob: new Blob([bytes], { type: MIME[dimensions.format] }),
      },
    ],
    report: {
      output: JSON.stringify({ headers: ['Item', 'Details'], rows }),
      render: 'table',
    },
    notes,
    warnings: warnings.length ? warnings : undefined,
    stats: {
      resolution: formatResolution(dimensions.width, dimensions.height),
      frameRate: formatFps(probe.fps),
      cameras: probe.devices?.length ?? 0,
      snapshotBytes: bytes.length,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
