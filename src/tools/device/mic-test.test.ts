import { describe, it, expect } from 'vitest';
import type { OptionValues } from '@/lib/types';
import { ToolError } from '@/lib/types';
import tool, { type MicRunExtras } from './mic-test.tool';
import {
  analyserBytesToFloat,
  amplitudeToDb,
  buildMicReport,
  computePeak,
  computeRms,
  dbToFraction,
  describeMicError,
  formatDb,
  levelVerdict,
  MAX_RECORDING_BYTES,
  meterSettings,
  MIN_RECORDING_MS,
  pickRecorderMime,
  readingOf,
  readingOfAnalyserBytes,
  readingOfChannels,
  recordingExtension,
  recorderFilename,
  validateRecording,
  type MicMetrics,
} from './mic-test.core';

const fileOf = (opts: {
  name?: string;
  type?: string;
  size?: number;
  metrics?: MicMetrics;
}): MicRunExtras & { files: File[]; options: OptionValues } => {
  const file = new File([new Uint8Array(opts.size ?? 4)], opts.name ?? 'take.webm', {
    type: opts.type ?? 'audio/webm;codecs=opus',
  });
  return { files: [file], options: {}, metrics: opts.metrics };
};

const alwaysSupported = () => true;
const neverSupported = () => false;

describe('mic-test run', () => {
  it('rejects when no file is provided', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(ToolError);
  });

  it('rejects an empty recording', async () => {
    await expect(tool.run(fileOf({ size: 0, metrics: { durationMs: 1000 } }))).rejects.toThrow(
      ToolError,
    );
  });

  it('rejects a clip that is not audio', async () => {
    await expect(
      tool.run(fileOf({ type: 'image/png', size: 100, metrics: { durationMs: 1000 } })),
    ).rejects.toThrow(/not an audio recording/);
  });

  it('rejects a clip that is too short', async () => {
    await expect(tool.run(fileOf({ size: 500, metrics: { durationMs: 50 } }))).rejects.toThrow(
      /too short/,
    );
  });

  it('produces a report + output for a healthy recording', async () => {
    const result = await tool.run(
      fileOf({
        name: 'my-take.webm',
        type: 'audio/webm;codecs=opus',
        size: 2048,
        metrics: { durationMs: 3200, sampleRate: 48000, channels: 1, peak: 0.5, rms: 0.1 },
      }),
    );
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toBe('my-take.webm');
    expect(result.report?.render).toBe('table');
    const data = JSON.parse(result.report!.output) as { headers: string[]; rows: string[][] };
    expect(data.headers).toEqual(['Property', 'Value']);
    const find = (label: string) => data.rows.find((r) => r[0] === label)?.[1];
    expect(find('Duration')).toBe('3.20 s');
    expect(find('Sample rate')).toBe('48,000 Hz');
    expect(find('Channels')).toBe('1');
    expect(find('Peak level')).toContain('-6.0 dB');
    expect(find('Level verdict')).toBe('Good level');
    expect(result.stats?.sizeBytes).toBe(2048);
    expect(result.stats?.durationMs).toBe(3200);
  });

  it('flags a clipping recording in warnings and stats', async () => {
    const result = await tool.run(
      fileOf({ size: 2048, metrics: { durationMs: 3000, peak: 1, rms: 0.2 } }),
    );
    expect(result.report?.output).toContain('Clipping');
    expect(result.warnings?.[0]).toMatch(/clips/i);
    expect(result.stats?.peakDb).toBe(0);
  });

  it('applies option defaults when options are omitted', async () => {
    const result = await tool.run(
      fileOf({ size: 128, metrics: { durationMs: 1000, peak: 0.4, rms: 0.08 } }),
    );
    expect(result.stats?.fftSize).toBe(2048);
    expect(result.stats?.maxSeconds).toBe(60);
  });

  it('respects custom options for the report', async () => {
    const input = fileOf({ size: 128, metrics: { durationMs: 1000, peak: 0.4, rms: 0.08 } });
    input.options = { fftSize: '8192', smoothing: 0.3, floorDb: -40, maxSeconds: 120 };
    const result = await tool.run(input);
    expect(result.stats?.fftSize).toBe(8192);
    expect(result.stats?.maxSeconds).toBe(120);
    const data = JSON.parse(result.report!.output) as { rows: string[][] };
    expect(data.rows.find((r) => r[0] === 'FFT size')?.[1]).toBe('8192');
    expect(data.rows.find((r) => r[0] === 'Meter floor')?.[1]).toBe('-40.0 dB');
  });

  it('warns when the take ran past the recording limit', async () => {
    const input = fileOf({ size: 4096, metrics: { durationMs: 90_000, peak: 0.4, rms: 0.1 } });
    const result = await tool.run(input);
    expect(result.warnings?.some((w) => /longer than the 60 s limit/.test(w))).toBe(true);
  });

  it('carries the recording through as a downloadable output', async () => {
    const input = fileOf({ size: 4096, metrics: { durationMs: 1500, peak: 0.3, rms: 0.06 } });
    const result = await tool.run(input);
    expect(result.outputs[0]!.blob.size).toBe(4096);
  });

  it('renames the output when the format and the name disagree', async () => {
    const input = fileOf({
      name: 'clip.ogg',
      type: 'audio/webm;codecs=opus',
      size: 1024,
      metrics: { durationMs: 1000, peak: 0.3, rms: 0.06 },
    });
    const result = await tool.run(input);
    expect(result.outputs[0]!.filename).toBe('clip.webm');
  });
});

describe('analyser bytes → float', () => {
  it('maps silence (128) to 0 and 0/255 to ±1', () => {
    const f = analyserBytesToFloat([128, 128, 128]);
    expect(Array.from(f)).toEqual([0, 0, 0]);
    expect(analyserBytesToFloat([0])[0]).toBe(-1);
    expect(analyserBytesToFloat([255])[0]).toBeCloseTo(0.9922, 3);
  });
});

describe('peak / RMS', () => {
  it('reads a frame of samples into peak and RMS', () => {
    const reading = readingOf(new Float32Array([0.5, -0.5]));
    expect(reading.peak).toBeCloseTo(0.5);
    expect(reading.rms).toBeCloseTo(0.5);
    expect(reading.peakDb).toBeCloseTo(-6.02, 1);
  });

  it('computes the largest absolute sample', () => {
    expect(computePeak([0.2, -0.9, 0.4])).toBeCloseTo(0.9);
    expect(computePeak([])).toBe(0);
  });

  it('computes RMS over a buffer', () => {
    const rms = computeRms([1, -1, 1, -1]);
    expect(rms).toBeCloseTo(1);
    expect(computeRms([0, 0, 0])).toBeCloseTo(0);
    expect(computeRms([])).toBe(0);
  });

  it('reads a byte frame to peak + RMS in dB', () => {
    const frame = new Uint8Array(2048).fill(128);
    for (let i = 0; i < 2048; i += 4) frame[i] = 204; // ~0.59
    const reading = readingOfAnalyserBytes(frame);
    expect(reading.peak).toBeCloseTo(0.59375, 2);
    expect(reading.peakDb).toBeCloseTo(-4.5, 0);
    expect(reading.rms).toBeGreaterThan(0);
  });

  it('reads mono and duplicated stereo channels at the same level', () => {
    const mono = readingOfChannels([new Float32Array([0.5, -0.5, 0.5, -0.5])]);
    const stereo = readingOfChannels([
      new Float32Array([0.5, -0.5, 0.5, -0.5]),
      new Float32Array([0.5, -0.5, 0.5, -0.5]),
    ]);
    expect(stereo.peak).toBeCloseTo(mono.peak, 6);
    expect(stereo.rms).toBeCloseTo(mono.rms, 6);
  });
});

describe('dB helpers', () => {
  it('maps full scale to 0 dB and half scale to ≈ −6 dB', () => {
    expect(amplitudeToDb(1)).toBeCloseTo(0);
    expect(amplitudeToDb(0.5)).toBeCloseTo(-6.02, 1);
    expect(amplitudeToDb(0)).toBe(-Infinity);
    expect(amplitudeToDb(-0.2)).toBe(-Infinity);
  });

  it('sits a dB value on a floor-to-zero meter', () => {
    expect(dbToFraction(-80, -80)).toBe(0);
    expect(dbToFraction(0, -80)).toBe(1);
    expect(dbToFraction(-40, -80)).toBeCloseTo(0.5);
    expect(dbToFraction(-20, -80)).toBeCloseTo(0.75);
    expect(dbToFraction(-Infinity, -80)).toBe(0);
    // Clamped at both ends: below the floor reads empty, above full scale full.
    expect(dbToFraction(-120, -80)).toBe(0);
    expect(dbToFraction(6, -80)).toBe(1);
  });

  it('formats dB readouts', () => {
    expect(formatDb(-6.02)).toBe('-6.0 dB');
    expect(formatDb(-Infinity)).toBe('−∞ dB');
  });
});

describe('level verdicts', () => {
  it('is silent when nothing reaches the analyser', () => {
    expect(levelVerdict({ peak: 0, rms: 0, peakDb: -Infinity, rmsDb: -Infinity }).tone).toBe(
      'silent',
    );
  });
  it('is clipping at full scale', () => {
    expect(levelVerdict({ peak: 1, rms: 0.5, peakDb: 0, rmsDb: -6 }).tone).toBe('clip');
  });
  it('is quiet for a faint signal', () => {
    expect(levelVerdict({ peak: 0.02, rms: 0.005, peakDb: -34, rmsDb: -46 }).tone).toBe('quiet');
  });
  it('is good in the working band', () => {
    expect(levelVerdict({ peak: 0.5, rms: 0.1, peakDb: -6, rmsDb: -20 }).tone).toBe('good');
  });
  it('is hot when very loud but not clipping', () => {
    expect(levelVerdict({ peak: 0.9, rms: 0.6, peakDb: -0.9, rmsDb: -4.4 }).tone).toBe('loud');
  });
  it('is not measured without levels', () => {
    expect(levelVerdict({ peak: NaN, rms: NaN, peakDb: -Infinity, rmsDb: -Infinity }).tone).toBe(
      'unknown',
    );
  });
  it('is quiet when the signal is faint but present', () => {
    expect(levelVerdict({ peak: 0.12, rms: 0.03, peakDb: -18.4, rmsDb: -30.5 }).tone).toBe('quiet');
  });
});

describe('recording validation', () => {
  it('accepts a healthy clip, and clips at the boundaries exactly', () => {
    // A normal take, at the exact length and size limits, with an unknown MIME
    // type from a browser that does not report one: all pass.
    expect(() =>
      validateRecording({ size: 4096, type: 'audio/webm;codecs=opus', durationMs: 2000 }),
    ).not.toThrow();
    expect(() =>
      validateRecording({
        size: MAX_RECORDING_BYTES,
        type: '',
        durationMs: MIN_RECORDING_MS,
      }),
    ).not.toThrow();
    // One step outside either limit is rejected, with the matching message.
    expect(() =>
      validateRecording({
        size: MAX_RECORDING_BYTES + 1,
        type: 'audio/webm',
        durationMs: 2000,
      }),
    ).toThrow(/too large/);
    expect(() =>
      validateRecording({ size: 4096, type: 'audio/webm', durationMs: MIN_RECORDING_MS - 1 }),
    ).toThrow(/too short/);
  });
  it('throws on a missing size', () => {
    expect(() => validateRecording({ size: 0, type: 'audio/webm', durationMs: 500 })).toThrow(
      ToolError,
    );
  });
  it('throws on a non-audio type', () => {
    expect(() => validateRecording({ size: 100, type: 'text/plain', durationMs: 1000 })).toThrow(
      /not an audio recording/,
    );
  });
  it('throws on an absurdly large clip', () => {
    expect(() =>
      validateRecording({ size: 300 * 1024 * 1024, type: 'audio/webm', durationMs: 5000 }),
    ).toThrow(/too large/);
  });
  it('throws on a too-short clip', () => {
    expect(() => validateRecording({ size: 1024, type: 'audio/webm', durationMs: 100 })).toThrow(
      /too short/,
    );
  });
});

describe('recording naming', () => {
  it('maps mime to an extension', () => {
    expect(recordingExtension('audio/webm;codecs=opus')).toBe('webm');
    expect(recordingExtension('audio/ogg')).toBe('ogg');
    expect(recordingExtension('audio/mp4')).toBe('m4a');
    expect(recordingExtension('audio/wav')).toBe('wav');
    expect(recordingExtension('audio/mpeg')).toBe('mp3');
    expect(recordingExtension('audio/flac')).toBe('flac');
    expect(recordingExtension('')).toBe('webm');
  });

  it('builds a timestamped filename', () => {
    const at = new Date(2026, 0, 24, 15, 30, 5); // local: 2026-01-24 15:30:05
    expect(recorderFilename('audio/webm', at)).toBe('mic-recording-20260124-153005.webm');
    expect(recorderFilename('audio/ogg', at)).toBe('mic-recording-20260124-153005.ogg');
  });
});

describe('mime picking', () => {
  it('returns the first supported preferred type', () => {
    expect(pickRecorderMime(['audio/webm', 'audio/ogg'], alwaysSupported)).toBe('audio/webm');
    expect(pickRecorderMime(['audio/webm'], neverSupported)).toBe('');
  });
});

describe('settings', () => {
  it('clamps junk option values', () => {
    const s = meterSettings({ fftSize: 'not a size', smoothing: 99, floorDb: 0, maxSeconds: -3 });
    expect(s.fftSize).toBe(2048);
    expect(s.smoothing).toBe(1);
    expect(s.floorDb).toBe(-20);
    expect(s.maxSeconds).toBe(1);
  });
  it('coerces numbers from strings', () => {
    const s = meterSettings({
      fftSize: '4096',
      smoothing: '0.2',
      floorDb: '-40',
      maxSeconds: '30',
    });
    expect(s.fftSize).toBe(4096);
    expect(s.smoothing).toBeCloseTo(0.2);
    expect(s.floorDb).toBe(-40);
    expect(s.maxSeconds).toBe(30);
  });
  it('falls back to defaults when options are omitted', () => {
    const s = meterSettings({});
    expect(s.fftSize).toBe(2048);
    expect(s.smoothing).toBeCloseTo(0.6);
    expect(s.floorDb).toBe(-80);
    expect(s.maxSeconds).toBe(60);
  });
});

describe('error mapping', () => {
  it('explains a permission denial', () => {
    const err = describeMicError(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    expect(err.message).toMatch(/permission was denied/i);
  });
  it('explains a missing device', () => {
    const err = describeMicError(Object.assign(new Error('none'), { name: 'NotFoundError' }));
    expect(err.message).toMatch(/No microphone was found/i);
  });
  it('falls back to a generic message', () => {
    expect(describeMicError(new Error('boom')).message).toMatch(/could not be started/i);
  });
});

describe('report building', () => {
  const base = {
    filename: 'take.webm',
    sizeBytes: 2048,
    type: 'audio/webm;codecs=opus',
    settings: meterSettings({}),
  };

  it('lists not-measured rows when metrics are absent', () => {
    const report = buildMicReport(base);
    expect(report.rows.some((r) => r[1] === 'not measured')).toBe(true);
    expect(report.warnings).toEqual([]);
  });

  it('warns about silence in the take', () => {
    const report = buildMicReport({
      ...base,
      metrics: { durationMs: 3000, sampleRate: 48000, channels: 1, peak: 0, rms: 0 },
    });
    expect(report.verdict.tone).toBe('silent');
    expect(report.warnings.some((w) => /silent/i.test(w))).toBe(true);
  });
});
