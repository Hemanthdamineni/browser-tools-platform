import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './mic-test.meta';
import {
  amplitudeToDb,
  buildMicReport,
  meterSettings,
  recordingExtension,
  validateRecording,
  type MicMetrics,
} from './mic-test.core';

/**
 * Extra payload the panel sends alongside the recorded file.
 *
 * `run()` stays a pure function of its input: the panel measures the take
 * (decode → peak/RMS → duration) and hands the numbers over, because decoding
 * audio needs an AudioContext, which the worker that runs this module has not
 * got.
 */
export interface MicRunExtras {
  metrics?: MicMetrics;
}

/** Output filename: the recording's basename plus the extension its format implies. */
function outputName(fileName: string, type: string): string {
  const base = fileName.replace(/\.[a-z0-9]{1,6}$/i, '').trim() || 'recording';
  return `${base}.${recordingExtension(type)}`;
}

async function run(input: FileRunInput & MicRunExtras): Promise<FileRunResult> {
  const settings = meterSettings(resolveOptions(meta, input.options));
  const file = input.files[0];

  if (!file) {
    throw new ToolError(
      'Record something first.',
      'Press “Enable microphone”, then “Record” — the take is analysed here as soon as you stop.',
    );
  }

  const metrics = input.metrics;
  const format = file.type || metrics?.format || '';
  validateRecording({ size: file.size, type: format, durationMs: metrics?.durationMs });
  input.signal?.throwIfAborted?.();
  input.onProgress?.(0.5, 'Summarising the recording');

  const filename = outputName(file.name, format);
  const report = buildMicReport({
    filename,
    sizeBytes: file.size,
    type: format,
    metrics,
    settings,
  });

  const stats: Record<string, string | number> = {
    sizeBytes: file.size,
    fftSize: settings.fftSize,
    maxSeconds: settings.maxSeconds,
  };
  const peak = metrics?.peak;
  const rms = metrics?.rms;
  if (typeof peak === 'number' && Number.isFinite(peak)) {
    const peakDb = amplitudeToDb(peak);
    if (Number.isFinite(peakDb)) stats.peakDb = Math.round(peakDb * 10) / 10;
  }
  if (typeof rms === 'number' && Number.isFinite(rms)) {
    const rmsDb = amplitudeToDb(rms);
    if (Number.isFinite(rmsDb)) stats.rmsDb = Math.round(rmsDb * 10) / 10;
  }
  const { durationMs, sampleRate, channels } = {
    durationMs: metrics?.durationMs,
    sampleRate: metrics?.sampleRate,
    channels: metrics?.channels,
  };
  if (typeof durationMs === 'number' && Number.isFinite(durationMs)) {
    stats.durationMs = Math.round(durationMs);
  }
  if (typeof sampleRate === 'number' && Number.isFinite(sampleRate)) stats.sampleRate = sampleRate;
  if (typeof channels === 'number' && Number.isFinite(channels)) stats.channels = channels;

  input.onProgress?.(1, 'Done');

  return {
    outputs: [{ filename, blob: file }],
    report: {
      output: JSON.stringify({ headers: report.headers, rows: report.rows }),
      render: 'table',
    },
    warnings: report.warnings.length ? report.warnings : undefined,
    stats,
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
