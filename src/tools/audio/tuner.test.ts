import { describe, it, expect } from 'vitest';
import tool from './tuner.tool';
import { ToolError } from '@/lib/types';
import {
  yinPitchDetect,
  frequencyToNote,
  computeRms,
  midiToFrequency,
  semitoneName,
  needlePosition,
  formatCents,
  detectPitch,
} from '@/components/panels/tuner-panel';

/** A pure sine wave at `freq` Hz in a `n`-sample window at `sampleRate`. */
function sine(freq: number, sampleRate: number, n: number, amp = 0.5): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  return out;
}

/** Cents between a detected frequency and a target. */
function centsErr(detected: number, target: number): number {
  return 1200 * Math.log2(detected / target);
}

const FS = 48000;
const N = 4096;

/** Run the tool's `run()` with raw text and options. */
const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  tool.run({ text, options });

describe('YIN pitch detector', () => {
  it('detects 440 Hz as A4 within ±2 cents', () => {
    const result = yinPitchDetect(sine(440, FS, N), { sampleRate: FS });
    expect(result.frequency).not.toBeNull();
    expect(Math.abs(centsErr(result.frequency!, 440))).toBeLessThanOrEqual(2);
    const note = frequencyToNote(result.frequency!, 440);
    expect(note).not.toBeNull();
    expect(`${note!.name}${note!.octave}`).toBe('A4');
    expect(Math.abs(note!.cents)).toBeLessThanOrEqual(2);
  });

  it('detects low guitar strings without octave error', () => {
    // E2 = 82.41 Hz, the low E on a guitar.
    const result = yinPitchDetect(sine(82.41, FS, N), { sampleRate: FS });
    expect(result.frequency).not.toBeNull();
    const note = frequencyToNote(result.frequency!, 440);
    expect(`${note!.name}${note!.octave}`).toBe('E2');
    expect(Math.abs(centsErr(result.frequency!, 82.41))).toBeLessThanOrEqual(2);
  });

  it('detects a high note within a generous tolerance', () => {
    // A5 = 880 Hz — window resolution limits precision, so assert the note.
    const result = yinPitchDetect(sine(880, FS, N), { sampleRate: FS });
    expect(result.frequency).not.toBeNull();
    const note = frequencyToNote(result.frequency!, 440);
    expect(`${note!.name}${note!.octave}`).toBe('A5');
    expect(Math.abs(centsErr(result.frequency!, 880))).toBeLessThanOrEqual(10);
  });

  it('honours the A4 calibration offset', () => {
    // A real 442 Hz tone with A4 = 442 should sit near 0 cents.
    const result = yinPitchDetect(sine(442, FS, N), { sampleRate: FS });
    expect(result.frequency).not.toBeNull();
    const note = frequencyToNote(result.frequency!, 442);
    expect(`${note!.name}${note!.octave}`).toBe('A4');
    expect(Math.abs(note!.cents)).toBeLessThanOrEqual(5);
  });

  it('treats silence as no pitch', () => {
    const silent = new Float32Array(N); // all zeros
    const result = yinPitchDetect(silent, { sampleRate: FS });
    expect(result.frequency).toBeNull();
    expect(result.reason).toBe('silent');
    expect(computeRms(silent)).toBe(0);
  });

  it('treats quiet noise as no pitch (silence gate)', () => {
    const noise = new Float32Array(N);
    for (let i = 0; i < N; i++) noise[i] = (Math.random() * 2 - 1) * 1e-5;
    const result = yinPitchDetect(noise, { sampleRate: FS });
    expect(result.frequency).toBeNull();
    expect(result.reason).toBe('silent');
  });

  it('detects a near-boundary note as sharp or flat correctly', () => {
    // A4 sharpened 30 cents ≈ 450.79 Hz.
    const sharp = yinPitchDetect(sine(440 * Math.pow(2, 30 / 1200), FS, N), { sampleRate: FS });
    const sharpNote = frequencyToNote(sharp.frequency!, 440);
    expect(sharpNote!.cents).toBeGreaterThan(20);

    // A4 flattened 30 cents ≈ 429.51 Hz.
    const flat = yinPitchDetect(sine(440 * Math.pow(2, -30 / 1200), FS, N), { sampleRate: FS });
    const flatNote = frequencyToNote(flat.frequency!, 440);
    expect(flatNote!.cents).toBeLessThan(-20);
  });

  it('reports no pitch when the window is too short for the range', () => {
    // A 40-sample window cannot resolve a 55 Hz fundamental at 48 kHz.
    const tiny = yinPitchDetect(sine(55, FS, 64), { sampleRate: FS });
    // Either no confident pitch or a period within the window — never a crash.
    expect(tiny.frequency).toBeNull();
  });
});

describe('note mapping', () => {
  it('maps MIDI 69 to A4 at 440 Hz', () => {
    expect(midiToFrequency(69, 440)).toBeCloseTo(440, 3);
  });

  it('maps MIDI 81 to A5 at 880 Hz', () => {
    expect(midiToFrequency(81, 440)).toBeCloseTo(880, 3);
  });

  it('names notes with sharps and flats', () => {
    expect(semitoneName(61, 'sharps')).toBe('C♯');
    expect(semitoneName(61, 'flats')).toBe('D♭');
  });

  it('rejects non-finite frequencies', () => {
    expect(frequencyToNote(Number.NaN)).toBeNull();
    expect(frequencyToNote(-5)).toBeNull();
  });
});

describe('needle and cents helpers', () => {
  it('centres the needle on zero cents', () => {
    expect(needlePosition(0)).toBe(0.5);
  });

  it('clamps the needle at the edges', () => {
    expect(needlePosition(100)).toBe(1);
    expect(needlePosition(-100)).toBe(0);
  });

  it('formats cents with a sign', () => {
    expect(formatCents(-3.2)).toBe('−3.2 ¢');
    expect(formatCents(0)).toBe('0.0 ¢');
  });
});

describe('detectPitch pipeline', () => {
  it('returns a note for a clean sine and null for silence', () => {
    const clean = detectPitch(sine(440, FS, N), FS, {});
    expect(clean.note).not.toBeNull();
    expect(clean.pitch.frequency).not.toBeNull();

    const quiet = detectPitch(new Float32Array(N), FS, {});
    expect(quiet.note).toBeNull();
    expect(quiet.pitch.reason).toBe('silent');
  });
});

describe('tuner run', () => {
  it('reports a known-good tuning with an exact expected value', () => {
    const out = run('440 440.5 439.5 441 440', {}) as {
      output: string;
      render: string;
      stats: Record<string, string | number>;
      notes: string[];
    };
    expect(out.render).toBe('table');
    const table = JSON.parse(out.output) as { headers: string[]; rows: string[][] };
    expect(table.headers).toEqual(['Note', 'Reference', 'Average', 'Deviation', 'In tune']);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]![0]).toBe('A4');
    expect(table.rows[0]![1]).toBe('440.0 Hz');
    expect(out.stats['Notes heard']).toBe(1);
    expect(out.stats.Readings).toBe(5);
    expect(out.stats['In tune']).toBe('5 of 5');
  });

  it('returns empty output for empty input (tool contract)', () => {
    // runTuner throws for empty input; empty text must surface a friendly error.
    expect(() => run('')).toThrow(ToolError);
  });

  it('rejects an unparseable frequency list', () => {
    expect(() => run('abc')).toThrow(/not a list of frequencies/);
  });

  it('rejects an empty snapshot', () => {
    expect(() => run('{"readings":[],"sampleRate":48000}')).toThrow(/no readings/);
  });

  it('honours the A4 calibration option in the report', () => {
    // A real 442 Hz tone, but A4 = 440: it should read as A4 sharp.
    const out = run('442', { a4: 440 }) as { output: string };
    const table = JSON.parse(out.output) as { rows: string[][] };
    expect(table.rows[0]![0]).toBe('A4');
    // Deviation should be sharp of 440.
    const deviation = table.rows[0]![3]!;
    expect(deviation).toMatch(/[+]|−/);
    // Recalibrate to 442 and it reads as in tune instead.
    const recal = run('442', { a4: 442 }) as {
      output: string;
      stats: Record<string, string | number>;
    };
    const recalTable = JSON.parse(recal.output) as { rows: string[][] };
    expect(recalTable.rows[0]![3]).toBe('0.0 ¢');
    expect(recal.stats.Calibration).toBe('A4 = 442.0 Hz');
  });

  it('switches note notation to flats', () => {
    // D♯4 = 311.13 Hz — with flats it renders D♭-adjacent spelling.
    const out = run('311.13', { notation: 'flats' }) as { output: string };
    const table = JSON.parse(out.output) as { rows: string[][] };
    expect(table.rows[0]![0]).toBe('E♭4');
    const sharpOut = run('311.13', { notation: 'sharps' }) as { output: string };
    const sharpTable = JSON.parse(sharpOut.output) as { rows: string[][] };
    expect(sharpTable.rows[0]![0]).toBe('D♯4');
  });

  it('applies the in-tune tolerance to the report counts', () => {
    // A4 sharpened 8 cents should be marked out of tune at ±2 but in tune at ±10.
    const sharp = 440 * Math.pow(2, 8 / 1200);
    const tight = run(String(sharp), { toleranceCents: 2 }) as {
      output: string;
      stats: Record<string, string | number>;
    };
    expect(tight.stats['In tune']).toBe('0 of 1');
    const loose = run(String(sharp), { toleranceCents: 10 }) as {
      output: string;
      stats: Record<string, string | number>;
    };
    expect(loose.stats['In tune']).toBe('1 of 1');
  });

  it('rejects negative or zero frequencies', () => {
    expect(() => run('440 -5')).toThrow(ToolError);
  });
});
