import { describe, it, expect } from 'vitest';
import tool from './mic-test.tool';
import { ToolError } from '@/lib/types';
import {
  SILENCE_DB,
  checkMicEnvironment,
  chooseRecorderMimeType,
  computePeakDb,
  computeRmsDb,
  computeRms,
  decayPeakHold,
  dbToMeterScale,
  describeMediaError,
  extensionForMimeType,
  formatDb,
  formatElapsed,
  isSilentSummary,
  linearToDb,
  parseMeasurements,
  readFrameSize,
  readMeterRange,
  recordingFilename,
  safeRecordingName,
  summariseLevels,
  type LevelFrame,
} from './mic-test.core';

/** A full-scale square wave: alternating +1 / −1. */
function squareWave(samples = 512): Float32Array {
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i++) out[i] = i % 2 === 0 ? 1 : -1;
  return out;
}

/** A sine wave at 50 % amplitude (0.5 peak). */
function halfSine(samples = 2048, amplitude = 0.5): Float32Array {
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    out[i] = Math.sin((2 * Math.PI * i) / 100) * amplitude;
  }
  return out;
}

/** The JSON payload the panel hands to the tool. */
function payload(overrides: Record<string, unknown> = {}): string {
  const rms: number[] = [];
  const peak: number[] = [];
  for (let i = 0; i < 120; i++) {
    rms.push(0.1);
    peak.push(0.2 + (i % 10) * 0.03);
  }
  return JSON.stringify({
    deviceLabel: 'Test Microphone',
    sampleRate: 48000,
    channels: 1,
    durationMs: 2000,
    mimeType: 'audio/webm',
    rms,
    peak,
    peakWindow: Array.from(halfSine(64)),
    ...overrides,
  });
}

/** A recorded clip, as the panel would hand it over. */
function clip(name = 'clip.webm', type = 'audio/webm'): File {
  return new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], name, { type });
}

async function run(
  options: Record<string, string | number | boolean> = {},
  text: string | undefined = payload(),
  files: File[] = [clip()],
): Promise<Awaited<ReturnType<typeof tool.run>>> {
  return tool.run({ files, options, text });
}

describe('mic-test level maths', () => {
  it('turns silence into a finite floor, never -Infinity', () => {
    const silence = new Float32Array(64);
    expect(computeRms(silence)).toBe(0);
    expect(computeRmsDb(silence)).toBe(SILENCE_DB);
    expect(linearToDb(0)).toBe(SILENCE_DB);
    expect(Number.isFinite(linearToDb(0))).toBe(true);
    expect(linearToDb(0)).not.toBe(Number.NEGATIVE_INFINITY);
  });

  it('measures a full-scale square wave at 0 dBFS', () => {
    const wave = squareWave();
    expect(computeRmsDb(wave)).toBeCloseTo(0, 6);
    expect(computePeakDb(wave)).toBeCloseTo(0, 6);
  });

  it('measures a 50 % sine at its true RMS, not its peak', () => {
    const wave = halfSine();
    // RMS of a full-amplitude sine is A / sqrt(2); at A = 0.5 that is -9.03 dBFS.
    expect(computeRmsDb(wave)).toBeCloseTo(-9.03, 1);
    expect(computePeakDb(wave)).toBeCloseTo(-6.02, 1);
    expect(computeRmsDb(wave)).toBeLessThan(computePeakDb(wave));
  });

  it('never produces NaN for odd amplitudes', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -1, 0, 1e-12, 2]) {
      const db = linearToDb(value);
      expect(Number.isFinite(db)).toBe(true);
      expect(db).toBeLessThanOrEqual(0);
      expect(db).toBeGreaterThanOrEqual(SILENCE_DB);
      expect(formatDb(db)).not.toMatch(/NaN|Infinity/);
    }
  });

  it('formats decibels without NaN', () => {
    expect(formatDb(-12.34)).toBe('-12.3 dBFS');
    expect(formatDb(0)).toBe('0.0 dBFS');
    expect(formatDb(-0)).toBe('0.0 dBFS');
    expect(formatDb(Number.NaN)).toBe('—');
    expect(formatDb(Number.NEGATIVE_INFINITY)).toBe('−∞ dBFS');
  });

  it('maps decibels onto the meter scale', () => {
    expect(dbToMeterScale(0, -60, 0)).toBe(1);
    expect(dbToMeterScale(-60, -60, 0)).toBe(0);
    expect(dbToMeterScale(-30, -60, 0)).toBeCloseTo(0.5, 6);
    expect(dbToMeterScale(-120, -60, 0)).toBe(0);
    expect(dbToMeterScale(Number.NaN, -60, 0)).toBe(0);
    expect(dbToMeterScale(0, -90, 0)).toBe(1);
  });

  it('lets the peak-hold marker fall back slowly', () => {
    expect(decayPeakHold(-6, 0)).toBe(-6);
    // 12 dB/s: one second of quiet costs 12 dB, not the whole level.
    expect(decayPeakHold(-6, 1000, 12)).toBeCloseTo(-18, 6);
    expect(decayPeakHold(-6, 100, 12)).toBeCloseTo(-7.2, 6);
    expect(decayPeakHold(-6, 100_000, 12)).toBe(SILENCE_DB);
  });
});

describe('mic-test level summaries', () => {
  it('summarises a realistic recording', () => {
    const frames: LevelFrame[] = [];
    for (let i = 0; i < 100; i++) {
      frames.push({ rms: 0.1, peak: i === 42 ? 0.5 : 0.2 });
    }
    const summary = summariseLevels(frames);
    expect(summary.frames).toBe(100);
    expect(summary.peakDb).toBeCloseTo(-6.02, 1);
    expect(summary.rmsDb).toBeCloseTo(-20, 1);
    expect(summary.averageDb).toBeCloseTo(-20, 1);
    expect(summary.loudestDb).toBeCloseTo(-20, 1);
    expect(summary.quietestDb).toBeCloseTo(-20, 1);
    expect(summary.clipped).toBe(false);
  });

  it('flags a recording that reached full scale', () => {
    const summary = summariseLevels([
      { rms: 0.1, peak: 0.2 },
      { rms: 0.9, peak: 1 },
    ]);
    expect(summary.clipped).toBe(true);
    expect(summary.peakDb).toBe(0);
  });

  it('reports an empty series as silence, not as a crash', () => {
    const summary = summariseLevels([]);
    expect(summary.frames).toBe(0);
    expect(summary.peakDb).toBe(SILENCE_DB);
    expect(summary.clipped).toBe(false);
    expect(isSilentSummary(summary)).toBe(false);
  });

  it('detects a silent track', () => {
    const silent = summariseLevels([
      { rms: 0, peak: 0 },
      { rms: 0, peak: 0 },
    ]);
    expect(isSilentSummary(silent)).toBe(true);
    const working = summariseLevels([{ rms: 0.1, peak: 0.3 }]);
    expect(isSilentSummary(working)).toBe(false);
  });
});

describe('mic-test error states', () => {
  it('refuses to run on an insecure page', () => {
    const problem = checkMicEnvironment({
      secureContext: false,
      hasMediaDevices: true,
      hasGetUserMedia: true,
      hasMediaRecorder: true,
    });
    expect(problem?.message).toMatch(/secure/i);
    expect(problem?.hint).toMatch(/https/i);
  });

  it('refuses to run without getUserMedia', () => {
    const problem = checkMicEnvironment({
      secureContext: true,
      hasMediaDevices: false,
      hasGetUserMedia: false,
      hasMediaRecorder: true,
    });
    expect(problem?.message).toMatch(/cannot open a microphone/i);
  });

  it('says so when the browser cannot record', () => {
    const problem = checkMicEnvironment({
      secureContext: true,
      hasMediaDevices: true,
      hasGetUserMedia: true,
      hasMediaRecorder: false,
    });
    expect(problem?.message).toMatch(/cannot record/i);
    expect(problem?.hint).toMatch(/meter still works/i);
  });

  it('accepts a capable browser', () => {
    expect(
      checkMicEnvironment({
        secureContext: true,
        hasMediaDevices: true,
        hasGetUserMedia: true,
        hasMediaRecorder: true,
      }),
    ).toBeNull();
  });

  it('explains a denied permission and a missing microphone differently', () => {
    const denied = describeMediaError({ name: 'NotAllowedError' });
    expect(denied.message).toMatch(/denied/i);
    expect(denied.hint).toMatch(/site settings/i);

    const missing = describeMediaError({ name: 'NotFoundError' });
    expect(missing.message).toMatch(/no microphone/i);
    expect(missing.hint).not.toBe(denied.hint);

    const busy = describeMediaError({ name: 'NotReadableError' });
    expect(busy.message).toMatch(/could not be opened/i);

    const unknown = describeMediaError({ name: 'WhateverError' });
    expect(unknown.message).toMatch(/could not be started/i);
    expect(unknown.hint.length).toBeGreaterThan(10);
  });
});

describe('mic-test recording formats', () => {
  it('prefers WebM/Opus and falls back to MP4', () => {
    const webm = chooseRecorderMimeType((type) => type.startsWith('audio/webm'));
    expect(webm?.mimeType).toBe('audio/webm;codecs=opus');
    expect(webm?.extension).toBe('webm');

    const mp4 = chooseRecorderMimeType((type) => type.startsWith('audio/mp4'));
    expect(mp4?.mimeType).toBe('audio/mp4;codecs=mp4a.40.2');
    expect(mp4?.extension).toBe('mp4');
  });

  it('returns null when the browser supports none of them', () => {
    expect(chooseRecorderMimeType(() => false)).toBeNull();
  });

  it('names the download after the container that was recorded', () => {
    expect(extensionForMimeType('audio/webm;codecs=opus')).toBe('webm');
    expect(extensionForMimeType('audio/mp4')).toBe('mp4');
    expect(extensionForMimeType('audio/x-m4a')).toBe('m4a');
    expect(extensionForMimeType('audio/mpeg')).toBe('mp3');
    expect(extensionForMimeType('')).toBe('webm');
  });

  it('keeps Unicode in a file name but drops path characters', () => {
    expect(safeRecordingName('Mic 🎤 (Built-in)')).toBe('Mic 🎤 (Built-in)');
    expect(safeRecordingName('a/b\\c:d*e?f"g<h>i|j')).toBe('a-b-c-d-e-f-g-h-i-j');
    expect(safeRecordingName('   ')).toBe('');
    expect(recordingFilename('Mic 🎤', 'audio/mp4')).toBe('Mic 🎤.mp4');
    expect(recordingFilename('', 'audio/webm', 'mic-clip')).toBe('mic-clip.webm');
  });

  it('formats the elapsed time', () => {
    expect(formatElapsed(0)).toBe('0:00.0');
    expect(formatElapsed(83_400)).toBe('1:23.4');
    expect(formatElapsed(3_723_000)).toBe('1:02:03.0');
  });

  it('validates the option values', () => {
    expect(readMeterRange('40')).toBe(40);
    expect(readMeterRange('90')).toBe(90);
    expect(() => readMeterRange('123')).toThrow(ToolError);
    expect(() => readMeterRange('abc')).toThrow(ToolError);
    expect(readFrameSize('4096')).toBe(4096);
    expect(() => readFrameSize(1234)).toThrow(ToolError);
  });
});

describe('mic-test measurement payload', () => {
  it('reads a well-formed payload', () => {
    const parsed = parseMeasurements(payload());
    expect(parsed.deviceLabel).toBe('Test Microphone');
    expect(parsed.sampleRate).toBe(48000);
    expect(parsed.channels).toBe(1);
    expect(parsed.durationMs).toBe(2000);
    expect(parsed.rms).toHaveLength(120);
    expect(parsed.peakWindow).toHaveLength(64);
  });

  it('rejects a missing, malformed or inconsistent payload', () => {
    expect(() => parseMeasurements('')).toThrow(ToolError);
    expect(() => parseMeasurements(undefined)).toThrow(ToolError);
    expect(() => parseMeasurements('not json')).toThrow(ToolError);
    expect(() => parseMeasurements('[]')).toThrow(ToolError);
    expect(() => parseMeasurements(JSON.stringify({ rms: [0.1], peak: [0.1, 0.2] }))).toThrow(
      ToolError,
    );
    expect(() => parseMeasurements(JSON.stringify({ rms: ['x'], peak: [0.1] }))).toThrow(ToolError);
  });
});

describe('mic-test run', () => {
  it('rejects an empty input', async () => {
    await expect(run({}, payload(), [])).rejects.toThrow(ToolError);
    await expect(run({}, payload(), [new File([], 'empty.webm', { type: 'audio/webm' })])).rejects.toThrow(
      ToolError,
    );
    // No measurements at all: the panel always sends them, so this is a bug
    // in the caller and must not produce a made-up report.
    await expect(tool.run({ files: [clip()], options: {} })).rejects.toThrow(ToolError);
    await expect(run({}, 'not json')).rejects.toThrow(ToolError);
  });

  it('builds a report and a download for a recording', async () => {
    const result = await run();
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]?.filename).toBe('Test Microphone.webm');
    expect(result.outputs[0]?.blob.size).toBe(8);
    expect(result.report?.render).toBe('table');

    const table = JSON.parse(result.report?.output ?? '{}') as {
      headers: string[];
      rows: string[][];
    };
    expect(table.headers).toEqual(['Property', 'Value']);
    const row = (label: string): string | undefined =>
      table.rows.find((r) => r[0] === label)?.[1];
    expect(row('Microphone')).toBe('Test Microphone');
    expect(row('Sample rate')).toBe('48,000 Hz');
    expect(row('Duration')).toBe('2.00 s');
    expect(row('Channels')).toBe('1');
    expect(row('Peak level')).toBe('-6.6 dBFS');
    expect(row('RMS level')).toBe('-20.0 dBFS');
    expect(row('Clipping')).toBe('No');
    expect(row('Readings analysed')).toBe('120');
    expect(result.stats?.peakDb).toBeCloseTo(-6.6, 1);
    expect(result.stats?.rmsDb).toBeCloseTo(-20, 1);
    expect(result.stats?.durationMs).toBe(2000);
  });

  it('honours the meter range option', async () => {
    const result = await run({ meterRange: '40' });
    const table = JSON.parse(result.report?.output ?? '{}') as { rows: string[][] };
    const row = table.rows.find((r) => r[0] === 'Meter range');
    expect(row?.[1]).toBe('−40 … 0 dBFS');
  });

  it('honours the analysis frame option', async () => {
    const result = await run({ frameSize: '4096' });
    const table = JSON.parse(result.report?.output ?? '{}') as { rows: string[][] };
    const row = table.rows.find((r) => r[0] === 'Analysis frame');
    expect(row?.[1]).toBe('4,096 samples (85.3 ms)');
  });

  it('honours the recording name option', async () => {
    const result = await run({ clipName: 'my clip' });
    expect(result.outputs[0]?.filename).toBe('my clip.webm');
  });

  it('rejects an unknown option value instead of guessing', async () => {
    await expect(run({ meterRange: '123' })).rejects.toThrow(ToolError);
    await expect(run({ frameSize: '7' })).rejects.toThrow(ToolError);
  });

  it('names the download after an MP4 recording', async () => {
    const result = await run({}, payload(), [clip('clip.mp4', 'audio/mp4')]);
    expect(result.outputs[0]?.filename).toBe('Test Microphone.mp4');
    const table = JSON.parse(result.report?.output ?? '{}') as { rows: string[][] };
    expect(table.rows.find((r) => r[0] === 'Recording format')?.[1]).toBe('audio/mp4');
  });

  it('keeps a Unicode device label in the download name', async () => {
    const result = await run({}, payload({ deviceLabel: 'Mic 🎙️ (Built-in)' }));
    expect(result.outputs[0]?.filename).toBe('Mic 🎙️ (Built-in).webm');
    const table = JSON.parse(result.report?.output ?? '{}') as { rows: string[][] };
    expect(table.rows.find((r) => r[0] === 'Microphone')?.[1]).toBe('Mic 🎙️ (Built-in)');
  });

  it('never writes NaN or Infinity into the report', async () => {
    const silent = summariseLevels([{ rms: 0, peak: 0 }]);
    const result = await run(
      {},
      payload({ rms: [0, 0, 0], peak: [0, 0, 0], durationMs: 0 }),
    );
    expect(result.report?.output).not.toMatch(/NaN|Infinity/);
    expect(silent.peakDb).toBe(SILENCE_DB);
    const table = JSON.parse(result.report?.output ?? '{}') as { rows: string[][] };
    expect(table.rows.find((r) => r[0] === 'Peak level')?.[1]).toBe('-120.0 dBFS');
  });

  it('warns about a silent recording', async () => {
    const result = await run({}, payload({ rms: [0, 0], peak: [0, 0] }));
    expect(result.warnings?.join(' ')).toMatch(/silent/i);
  });

  it('warns about clipping', async () => {
    const result = await run({}, payload({ rms: [0.9], peak: [1] }));
    expect(result.warnings?.join(' ')).toMatch(/full scale/i);
    const table = JSON.parse(result.report?.output ?? '{}') as { rows: string[][] };
    expect(table.rows.find((r) => r[0] === 'Clipping')?.[1]).toBe('Yes');
  });

  it('works when the options are omitted entirely', async () => {
    const result = await tool.run({ files: [clip()], options: {}, text: payload() });
    expect(result.outputs).toHaveLength(1);
    expect(result.report?.output).toBeTruthy();
  });
});
