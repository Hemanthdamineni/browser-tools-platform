import { describe, it, expect } from 'vitest';
import tool, { generateClickTrack } from './metronome-click.tool';
import { ToolError } from '@/lib/types';

const options = (o: Record<string, string | number | boolean> = {}) => ({ bpm: 120, bars: 2, beatsPerBar: 4, sampleRate: 44100, ...o });

describe('generateClickTrack', () => {
  it('has the expected duration at the requested tempo', () => {
    const { channel, sampleRate } = generateClickTrack(options({ bpm: 120, bars: 2, beatsPerBar: 4 }));
    expect(channel.length).toBe(Math.round(8 * 0.5 * sampleRate));
  });

  it('places clicks at every beat and longer duration follows slower tempos', () => {
    const fast = generateClickTrack(options({ bpm: 120, bars: 1, beatsPerBar: 4 })).channel;
    const slow = generateClickTrack(options({ bpm: 60, bars: 1, beatsPerBar: 4 })).channel;
    expect(slow.length).toBe(fast.length * 2);
    for (const start of [0, 22050, 44100, 66150]) {
      expect(fast.slice(start, start + 100).some((x) => x !== 0)).toBe(true);
    }
  });

  it('respects the no-accent option', () => {
    const { channel } = generateClickTrack(options({ bpm: 120, bars: 1, beatsPerBar: 2, accentFirst: false }));
    const firstPeak = Math.max(...channel.slice(0, 1000).map(Math.abs));
    const secondPeak = Math.max(...channel.slice(22050, 23050).map(Math.abs));
    expect(firstPeak).toBeCloseTo(secondPeak, 4);
  });

  it('rejects invalid tempo, bars, meter and sample rate', () => {
    expect(() => generateClickTrack(options({ bpm: 10 }))).toThrow(ToolError);
    expect(() => generateClickTrack(options({ bars: 0 }))).toThrow(ToolError);
    expect(() => generateClickTrack(options({ beatsPerBar: 1.5 }))).toThrow(ToolError);
    expect(() => generateClickTrack(options({ sampleRate: 8000 }))).toThrow(ToolError);
  });
});

describe('metronome-click run', () => {
  it('returns WAV audio and tempo stats', async () => {
    const r = await tool.run({ text: '', options: options({ bars: 1 }) });
    expect(r.render).toBe('audio');
    expect(r.output.startsWith('data:audio/wav;base64,')).toBe(true);
    expect(r.filename).toBe('metronome.wav');
    expect(r.stats?.bpm).toBe(120);
  });
});
