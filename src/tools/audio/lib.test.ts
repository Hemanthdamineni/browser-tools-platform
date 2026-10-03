import { describe, it, expect } from 'vitest';
import {
  resampleChannel,
  remixChannels,
  clampChannels,
  toWavBlob,
  formatDuration,
  parseTime,
  dbToGain,
  amplitudeToDb,
} from './lib';
import { ToolError } from '@/lib/types';

describe('audio lib - resampleChannel', () => {
  it('returns a clone when rates match', () => {
    const orig = new Float32Array([0.1, 0.2, 0.3]);
    const res = resampleChannel(orig, 44100, 44100);
    expect(res).not.toBe(orig);
    expect(Array.from(res)).toEqual(Array.from(orig));
  });

  it('resamples to target length proportionally', () => {
    const orig = new Float32Array([0, 0.5, 1.0, 0.5]);
    const down = resampleChannel(orig, 4000, 2000);
    expect(down.length).toBe(2);
    const up = resampleChannel(orig, 4000, 8000);
    expect(up.length).toBe(8);
  });
});

describe('audio lib - remixChannels', () => {
  it('mixes stereo down to mono by averaging', () => {
    const l = new Float32Array([1.0, 0.0]);
    const r = new Float32Array([0.0, 1.0]);
    const mono = remixChannels([l, r], 1);
    expect(mono).toHaveLength(1);
    expect(mono[0]![0]).toBeCloseTo(0.5);
    expect(mono[0]![1]).toBeCloseTo(0.5);
  });

  it('duplicates mono to stereo', () => {
    const m = new Float32Array([1.0, 2.0]);
    const stereo = remixChannels([m], 2);
    expect(stereo).toHaveLength(2);
    expect(Array.from(stereo[0]!)).toEqual([1.0, 2.0]);
    expect(Array.from(stereo[1]!)).toEqual([1.0, 2.0]);
  });

  it('preserves existing stereo channels', () => {
    const l = new Float32Array([0.5]);
    const r = new Float32Array([0.25]);
    const stereo = remixChannels([l, r], 2);
    expect(stereo).toHaveLength(2);
    expect(stereo[0]![0]).toBe(0.5);
    expect(stereo[1]![0]).toBe(0.25);
  });
});

describe('audio lib - clampChannels', () => {
  it('detects clipping and clamps exceeding samples to [-1, 1]', () => {
    const ch = new Float32Array([-1.5, -0.5, 0, 0.5, 1.8]);
    const clipped = clampChannels([ch]);
    expect(clipped).toBe(true);
    expect(ch[0]).toBe(-1);
    expect(ch[4]).toBe(1);
    expect(ch[1]).toBe(-0.5);
  });

  it('returns false when no samples exceed bounds', () => {
    const ch = new Float32Array([-0.8, 0, 0.9]);
    const clipped = clampChannels([ch]);
    expect(clipped).toBe(false);
  });
});

describe('audio lib - formatting & conversions', () => {
  it('formats duration correctly', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(59)).toBe('0:59');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3665)).toBe('1:01:05');
  });

  it('parses valid time formats', () => {
    expect(parseTime('15')).toBe(15);
    expect(parseTime('1:30')).toBe(90);
    expect(parseTime('01:02:03')).toBe(3723);
  });

  it('rejects invalid time formats', () => {
    expect(() => parseTime('')).toThrow(ToolError);
    expect(() => parseTime('abc')).toThrow(ToolError);
    expect(() => parseTime('1:2:3:4')).toThrow(ToolError);
  });

  it('converts dB to gain correctly', () => {
    expect(dbToGain(0)).toBeCloseTo(1);
    expect(dbToGain(6)).toBeCloseTo(1.995, 2);
    expect(dbToGain(-6)).toBeCloseTo(0.501, 2);
  });

  it('converts amplitude to dBFS correctly', () => {
    expect(amplitudeToDb(1)).toBeCloseTo(0);
    expect(amplitudeToDb(0)).toBe(-Infinity);
    expect(amplitudeToDb(-0.5)).toBe(-Infinity);
    expect(amplitudeToDb(0.5)).toBeCloseTo(-6.02, 1);
  });

  it('encodes to a valid WAV blob', () => {
    const ch = new Float32Array([0, 0.25, -0.25, 0]);
    const blob = toWavBlob([ch], 44100);
    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBeGreaterThan(44);
  });
});
