/**
 * Screen recorder — the tool module.
 *
 * The recording itself happens on the page (the browser's `MediaRecorder` is
 * not available inside a worker), so the dedicated recorder panel captures
 * the clip and hands the finished file to this module. `run()` then validates
 * it and turns it into the downloadable artefact the workbench shows.
 *
 * Nothing leaves the device: the panel never uploads anything and this
 * module only reads the file it is given.
 */
import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { buildRecordingFilename, containerForMimeType } from './webcam-recorder-core';
import { meta } from './screen-recorder.meta';

/** Filename prefix used when the user does not pick one. */
export const DEFAULT_SCREEN_FILENAME_PREFIX = 'screen-recording';

/**
 * Package a recorded clip as the tool's download.
 *
 * The file the panel passes in is the raw recording; the name the user gets
 * is derived from the container it is in plus the time of the recording, so
 * two clips never overwrite each other.
 */
export async function runScreenRecorder(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const { files } = input;

  if (!files.length) {
    throw new ToolError(
      'Record a clip first.',
      'Press Share screen, pick a screen or window, then Record and Stop — the clip is captured in this tab and never uploaded.',
    );
  }
  if (files.length > 1) {
    throw new ToolError(
      `Keep one recording at a time — ${files.length} clips were supplied.`,
      'Record again to replace the clip on the page.',
    );
  }

  const file = files[0]!;
  if (!file.size) {
    throw new ToolError(
      'The recording is empty — there is nothing to save.',
      'Record for a second or two before pressing Stop.',
    );
  }

  const container = containerForMimeType(file.type);
  const filename = buildRecordingFilename(
    container,
    new Date(),
    String(o.filename ?? '') || DEFAULT_SCREEN_FILENAME_PREFIX,
  );
  const quality = String(o.quality ?? 'balanced');
  const mic = o.mic === true;

  const notes: string[] = [
    container === 'mp4'
      ? 'Recorded as MP4 (H.264) — it plays in almost every player.'
      : 'Recorded as WebM (VP8/VP9) — it plays in every modern browser; convert it to MP4 if you need it elsewhere.',
  ];
  notes.push(mic ? 'Recorded with microphone audio.' : 'Recorded without audio (microphone off).');
  if (quality !== 'balanced') {
    notes.push(`Recorded at the “${quality}” quality setting.`);
  }

  return {
    outputs: [{ filename, blob: file }],
    notes,
    stats: {
      container,
      sizeBytes: file.size,
      quality,
      mic: mic ? 1 : 0,
    },
  };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  return runScreenRecorder(input);
}

const tool: FileToolModule = { meta, run };
export default tool;
