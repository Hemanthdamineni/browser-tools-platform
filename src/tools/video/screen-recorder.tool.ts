import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { formatBytes } from '@/lib/format';
import {
  MAX_RECORDING_BYTES,
  extensionForFormat,
  formatDuration,
  formatForMimeType,
  formatFromFileName,
  labelForFormat,
  normalizeBitrate,
  normalizeDuration,
  outputFileName,
  type RecordingFormat,
} from './screen-recorder.core';
import { meta } from './screen-recorder.meta';

/**
 * Validate a recording and hand it back as a downloadable file.
 *
 * The capture itself happens in the panel (`ScreenRecorderPanel.astro`),
 * because `getDisplayMedia` and `MediaRecorder` are main-thread APIs. This
 * tool is the part that runs in the Web Worker: it checks the recording is
 * real, reports what is in it and names the output file.
 *
 * It works standalone too — hand it any recorded file and it reports on it.
 */
export async function runScreenRecorder(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const { files, signal, onProgress } = input;

  if (!files.length) {
    throw new ToolError(
      'There is no recording to process.',
      'Record your screen with the panel above first.',
    );
  }
  if (files.length > 1) {
    throw new ToolError(
      `Process one recording at a time — ${files.length} were supplied.`,
      'Record again to replace the current clip.',
    );
  }

  const file = files[0]!;
  signal?.throwIfAborted?.();
  onProgress?.(0.2, 'Checking the recording');

  if (file.size === 0) {
    throw new ToolError(
      'The recording is empty (0 bytes).',
      'It looks like the recording was stopped before any frames were captured — record again.',
    );
  }
  if (file.size > MAX_RECORDING_BYTES) {
    throw new ToolError(
      `The recording is ${formatBytes(file.size)} — larger than the ${formatBytes(MAX_RECORDING_BYTES)} limit.`,
      'Record a shorter clip, or pick a lower video quality.',
    );
  }

  onProgress?.(0.6, 'Reading the recording details');

  const requested: RecordingFormat = o.format === 'mp4' ? 'mp4' : 'webm';
  const recordedMime = typeof o.mimeType === 'string' ? o.mimeType : '';
  const format: RecordingFormat =
    formatForMimeType(file.type) ??
    formatFromFileName(file.name) ??
    formatForMimeType(recordedMime) ??
    requested;

  const durationSeconds = normalizeDuration(o.duration);
  const microphone = o.microphone === true;
  const bitrate = normalizeBitrate(o.videoBitsPerSecond);

  const warnings: string[] = [];
  if (requested === 'mp4' && format === 'webm') {
    warnings.push(
      'This browser could not record MP4, so the file is a WebM recording — MP4 is only offered where the browser supports it.',
    );
  }
  if (!formatForMimeType(file.type) && !formatFromFileName(file.name)) {
    warnings.push(
      'This file is not named like a WebM or MP4 recording, so its container could not be confirmed.',
    );
  }
  if (durationSeconds === null) {
    warnings.push('The length of the recording is unknown — the panel reports it as you stop.');
  }

  const rows: string[][] = [
    ['File name', file.name || 'screen-recording'],
    ['File size', `${formatBytes(file.size)} (${file.size.toLocaleString('en-US')} bytes)`],
    ['Container', `${labelForFormat(format)} (.${extensionForFormat(format)})`],
    ['Recorded type', file.type || recordedMime || 'Unknown'],
    ['Duration', formatDuration(durationSeconds)],
    ['Microphone', microphone ? 'Included' : 'Not included'],
    ['Video bitrate', bitrate ? `${(bitrate / 1_000_000).toFixed(1)} Mbps` : 'Browser default'],
  ];

  onProgress?.(1, 'Done');

  return {
    outputs: [{ filename: outputFileName(file.name, format), blob: file }],
    report: { output: JSON.stringify({ headers: ['Property', 'Value'], rows }), render: 'table' },
    warnings: warnings.length ? warnings : undefined,
    notes: ['Recorded on this device — the file was never uploaded.'],
    stats: {
      sizeBytes: file.size,
      durationSeconds: durationSeconds ?? 0,
      format,
      microphone: microphone ? 'yes' : 'no',
    },
  };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  return runScreenRecorder(input);
}

const tool: FileToolModule = { meta, run };
export default tool;
