import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { formatBytes } from '@/lib/format';
import { meta } from './mic-test.meta';
import {
  computePeakDb,
  computeRmsDb,
  dbToFullScalePercent,
  formatDb,
  isSilentSummary,
  parseMeasurements,
  readFrameSize,
  readMeterRange,
  recordingFilename,
  summariseLevels,
  type LevelFrame,
} from './mic-test.core';

/**
 * The microphone test report.
 *
 * The panel owns the browser APIs — it opens the microphone, drives the
 * analyser and records the clip — and hands the raw numbers over here. This
 * module turns them into decibels, a report table and a download.
 */
async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const meterRange = readMeterRange(o.meterRange);
  const frameSize = readFrameSize(o.frameSize);
  const clipName = typeof o.clipName === 'string' ? o.clipName.trim() : '';

  if (!input.files.length) {
    throw new ToolError(
      'There is no recording to report on.',
      'Press “Start microphone”, then “Record”, say something and press “Stop recording”.',
    );
  }
  const clip = input.files[0]!;
  if (clip.size === 0) {
    throw new ToolError('The recording is empty.', 'Record again — the clip held no data.');
  }

  input.onProgress?.(0.4, 'Measuring');
  const measurements = parseMeasurements(input.text);
  const frames: LevelFrame[] = measurements.rms.map((rms, index) => ({
    rms: Math.abs(rms),
    peak: Math.abs(measurements.peak[index] ?? rms),
  }));
  const summary = summariseLevels(frames);
  // The loudest window is kept as raw samples, so the report can also show
  // what that single window looked like — not just the averaged numbers.
  const windowPeakDb = measurements.peakWindow.length
    ? computePeakDb(measurements.peakWindow)
    : summary.peakDb;
  const windowRmsDb = measurements.peakWindow.length
    ? computeRmsDb(measurements.peakWindow)
    : summary.rmsDb;
  input.onProgress?.(0.9, 'Building the report');

  const mimeType = clip.type || measurements.mimeType || 'audio/webm';
  const filename = recordingFilename(clipName || measurements.deviceLabel, mimeType, 'mic-clip');
  const frameMs = measurements.sampleRate
    ? (frameSize / measurements.sampleRate) * 1000
    : 0;

  const rows: string[][] = [
    ['Microphone', measurements.deviceLabel],
    ['Recording format', mimeType],
    ['Duration', `${(measurements.durationMs / 1000).toFixed(2)} s`],
    ['Sample rate', measurements.sampleRate ? `${measurements.sampleRate.toLocaleString()} Hz` : '—'],
    ['Channels', String(measurements.channels)],
    [
      'Analysis frame',
      frameMs ? `${frameSize.toLocaleString()} samples (${frameMs.toFixed(1)} ms)` : `${frameSize.toLocaleString()} samples`,
    ],
    ['Peak level', formatDb(summary.peakDb)],
    ['Peak level (% of full scale)', `${dbToFullScalePercent(summary.peakDb).toFixed(1)} %`],
    ['RMS level', formatDb(summary.rmsDb)],
    ['Average level', formatDb(summary.averageDb)],
    ['Loudest window RMS', formatDb(summary.loudestDb)],
    ['Quietest window RMS', formatDb(summary.quietestDb)],
    ['Peak of the loudest window', formatDb(windowPeakDb)],
    ['RMS of the loudest window', formatDb(windowRmsDb)],
    ['Meter range', `−${meterRange} … 0 dBFS`],
    ['Clipping', summary.clipped ? 'Yes' : 'No'],
    ['Readings analysed', String(summary.frames)],
    ['File size', formatBytes(clip.size)],
  ];

  const warnings: string[] = [];
  if (summary.clipped) {
    warnings.push('The recording reached full scale — the input was too hot.');
  }
  if (isSilentSummary(summary)) {
    warnings.push('The browser returned a silent track — no signal was measured at all.');
  }
  if (measurements.durationMs > 0 && measurements.durationMs < 500) {
    warnings.push('The recording is shorter than half a second.');
  }

  input.onProgress?.(1, 'Done');
  return {
    outputs: [{ filename, blob: clip }],
    report: {
      output: JSON.stringify({ headers: ['Property', 'Value'], rows }),
      render: 'table',
    },
    notes: ['Measured on this device — the recording was never uploaded.'],
    warnings: warnings.length ? warnings : undefined,
    stats: {
      peakDb: Math.round(summary.peakDb * 10) / 10,
      rmsDb: Math.round(summary.rmsDb * 10) / 10,
      averageDb: Math.round(summary.averageDb * 10) / 10,
      peakPercent: Math.round(dbToFullScalePercent(summary.peakDb) * 10) / 10,
      durationMs: Math.round(measurements.durationMs),
      sampleRate: measurements.sampleRate,
      channels: measurements.channels,
      readings: summary.frames,
      clipped: summary.clipped ? 'yes' : 'no',
      bytes: clip.size,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
