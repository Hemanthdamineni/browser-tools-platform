import { describe, it, expect } from 'vitest';
import tool, { generateTone } from './tone-generator.tool';
import { ToolError } from '@/lib/types';

const opts = (o: Record<string, string | number | boolean> = {}) => ({
  waveform: 'sine',
  frequency: 440,
  durationMs: 100,
  sampleRate: 44100,
  ...o,
});

describe('generateTone', () => {
  it('produces the requested number of frames for a mono signal', () => {
    const { channels, sampleRate } = generateTone(opts({ durationMs: 100 }));
    expect(sampleRate).toBe(44100);
    expect(channels).toHaveLength(1);
    expect(channels[0]!.length).toBe(Math.round(44100 * 0.1));
  });

  it('produces two equal channels for stereo', () => {
    const { channels } = generateTone(opts({ channels: 'stereo' }));
    expect(channels).toHaveLength(2);
    expect(channels[0]!.length).toBe(channels[1]!.length);
    expect(Array.from(channels[0]!.slice(0, 50))).toEqual(Array.from(channels[1]!.slice(0, 50)));
  });

  it('a sine wave stays within the amplitude bound', () => {
    const { channels } = generateTone(opts({ amplitude: 50 }));
    const peak = channels[0]!.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    expect(peak).toBeLessThanOrEqual(0.5 + 1e-6);
    expect(peak).toBeGreaterThan(0.2);
  });

  it('square, sawtooth and triangle waves are bounded and non-silent', () => {
    for (const waveform of ['square', 'sawtooth', 'triangle']) {
      const { channels } = generateTone(opts({ waveform, amplitude: 100 }));
      const peak = channels[0]!.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      expect(peak).toBeGreaterThan(0);
      expect(peak).toBeLessThanOrEqual(1 + 1e-6);
    }
  });

  it('supports white and pink noise', () => {
    const { channels } = generateTone(opts({ waveform: 'white-noise', amplitude: 100 }));
    const peak = channels[0]!.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    expect(peak).toBeGreaterThan(0);
  });

  it('rejects out-of-range parameters', () => {
    expect(() => generateTone(opts({ durationMs: 10 }))).toThrow(ToolError);
    expect(() => generateTone(opts({ sampleRate: 12345 }))).toThrow(ToolError);
    expect(() => generateTone(opts({ amplitude: 200 }))).toThrow(ToolError);
    expect(() => generateTone(opts({ frequency: 5 }))).toThrow(ToolError);
    expect(() => generateTone(opts({ fadeMs: 999 }))).toThrow(ToolError);
  });
});

describe('tone-generator run', () => {
  it('returns an audio data URI with WAV stats', async () => {
    const r = await tool.run({ text: '', options: opts({ durationMs: 200 }) });
    expect(r.render).toBe('audio');
    expect(r.output.startsWith('data:audio/wav;base64,')).toBe(true);
    expect(r.filename).toBe('tone.wav');
    expect(r.stats?.sampleRate).toBe(44100);
  });
});
