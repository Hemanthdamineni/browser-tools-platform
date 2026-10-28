import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './webcam-test.meta';
import { captureFrame, readTrackSettings, snapshotFilename } from './webcam-test.core';

/**
 * Webcam Tester run().
 *
 * The panel (device picker, live preview, Start/Stop) does the camera work in
 * the browser and hands the tool the captured snapshot plus the track settings
 * it read back. `run()` validates and packages: it either saves the snapshot
 * the panel took, or reports the readout only.
 */
async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const snapshot = input.files[0];

  const stats: Record<string, string | number> = {};
  const notes: string[] = [];

  if (o.resolution) stats.resolution = String(o.resolution);
  if (o.fps) stats.fps = String(o.fps);
  if (o.width) stats.width = Number(o.width);
  if (o.height) stats.height = Number(o.height);
  if (o.frameRate) stats.frameRate = Math.round(Number(o.frameRate));
  if (o.cameraLabel) stats.camera = String(o.cameraLabel);

  if (o.width || o.height || o.frameRate) {
    notes.push(
      `Camera reported ${Number(o.width) || 0} × ${Number(o.height) || 0} @ ${Math.round(Number(o.frameRate) || 0)} fps.`,
    );
  }

  if (!snapshot) {
    // Readout-only run (the user pressed "Read settings" without a snapshot).
    if (!o.width && !o.height && !o.frameRate) {
      throw new ToolError(
        'No camera data yet.',
        'Press “Start camera” and let the readout populate, then run again.',
      );
    }
    return {
      outputs: [],
      report: {
        output: JSON.stringify(
          {
            camera: String(o.cameraLabel ?? ''),
            width: Number(o.width) || 0,
            height: Number(o.height) || 0,
            frameRate: Math.round(Number(o.frameRate) || 0),
          },
          null,
          2,
        ),
        render: 'code',
        language: 'json',
      },
      notes,
      stats,
    };
  }

  if (!snapshot.size) {
    throw new ToolError('The snapshot is empty — retake it.');
  }
  if (snapshot.type && snapshot.type !== 'image/png') {
    throw new ToolError(
      'The snapshot is not a PNG.',
      'The panel always captures PNG; reload the page and take the snapshot again.',
    );
  }

  return {
    outputs: [{ filename: snapshotFilename(new Date()), blob: snapshot }],
    notes: [...notes, 'Snapshot captured in this tab — nothing was uploaded.'],
    stats,
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
