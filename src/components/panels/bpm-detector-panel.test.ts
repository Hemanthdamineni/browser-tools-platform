import { describe, expect, it, vi } from 'vitest';

// The pure DSP below must not depend on the whole tool registry, so the panel's
// worker client is stubbed — the same seam the screen-recorder panel test uses.
vi.mock('@/lib/worker/client', () => ({ runToolById: vi.fn() }));

import {
  addTap,
  autocorrelate,
  averageTapTempo,
  bpmFromLag,
  detectTempo,
  fftReal,
  lagFromBpm,
  monoMix,
  spectralFlux,
  tapConfidence,
  tapStatus,
  tempoReport,
} from './bpm-detector-panel';

/* -------------------------------------------------------------------------- */
/*  Synthetic click-track helpers                                             */
/* -------------------------------------------------------------------------- */

/**
 * A click track: a short decaying sine burst at every beat of `bpm`.
 * This is the same impulse shape the `metronome-click` generator uses, so the
 * onset envelope is a clean periodic train.
 */
function clickTrack(bpm: number, seconds: number, sampleRate = 44100): Float32Array {
  const totalFrames = Math.round(seconds * sampleRate);
  const channel = new Float32Array(totalFrames);
  const beatFrames = Math.round((60 / bpm) * sampleRate);
  const clickFrames = Math.round(0.03 * sampleRate);
  for (let start = 0; start + clickFrames < totalFrames; start += beatFrames) {
    for (let i = 0; i < clickFrames; i++) {
      const t = i / sampleRate;
      channel[start + i] = Math.sin(2 * Math.PI * 1000 * t) * Math.exp(-t / 0.008);
    }
  }
  return channel;
}

/** Detect a tempo and normalise it to the `[minBpm, maxBpm]` window we used. */
function detect(bpm: number, minBpm = 70, maxBpm = 180): { bpm: number; confidence: number } {
  const track = clickTrack(bpm, 8);
  const result = detectTempo(track, 44100, { minBpm, maxBpm });
  return { bpm: result.bpm, confidence: result.confidence };
}

/* -------------------------------------------------------------------------- */
/*  FFT / onset primitives                                                    */
/* -------------------------------------------------------------------------- */

describe('fftReal', () => {
  it('returns a power-of-two result and rejects non-power-of-two input', () => {
    const impulse = new Float32Array(8);
    impulse[0] = 1;
    const out = fftReal(impulse);
    // DC bin should be 1 + 0i (an impulse has a flat spectrum).
    expect(out[0]).toBeCloseTo(1);
    expect(out[1]).toBeCloseTo(0);
    expect(() => fftReal(new Float32Array(6))).toThrow();
  });
});

describe('spectralFlux', () => {
  it('frames a signal at the expected frame rate', () => {
    const { flux, frameRate } = spectralFlux(new Float32Array(44100 * 4), 44100);
    expect(frameRate).toBeCloseTo(44100 / 512);
    expect(flux.length).toBeGreaterThan(300);
  });

  it('spikes at a clean click train', () => {
    const track = clickTrack(120, 8);
    const { flux, frameRate } = spectralFlux(track, 44100);
    // The strongest autocorrelation lag should sit near the beat period.
    const ac = autocorrelate(flux, 80);
    const beatLag = Math.round((60 / 120) * frameRate);
    let best = 0;
    let bestVal = -Infinity;
    for (let i = 1; i < ac.length; i++) {
      if ((ac[i] ?? 0) > bestVal) {
        bestVal = ac[i] ?? 0;
        best = i;
      }
    }
    expect(best).toBeGreaterThanOrEqual(beatLag - 2);
    expect(best).toBeLessThanOrEqual(beatLag + 2);
  });
});

/* -------------------------------------------------------------------------- */
/*  Tempo detection accuracy                                                   */
/* -------------------------------------------------------------------------- */

describe('detectTempo on synthetic click tracks', () => {
  it('detects 120 BPM within a few percent', () => {
    const { bpm } = detect(120);
    expect(bpm).toBeGreaterThanOrEqual(118);
    expect(bpm).toBeLessThanOrEqual(122);
  });

  it('detects 90 BPM within a few percent', () => {
    const { bpm } = detect(90, 70, 180);
    expect(bpm).toBeGreaterThanOrEqual(88);
    expect(bpm).toBeLessThanOrEqual(92);
  });

  it('detects 150 BPM within a few percent', () => {
    const { bpm } = detect(150, 120, 180);
    expect(bpm).toBeGreaterThanOrEqual(147);
    expect(bpm).toBeLessThanOrEqual(153);
  });

  it('reports the half-time reading when the real tempo is above the window', () => {
    // A 240 BPM click (true period 0.25 s) with a 100-180 window: the strongest
    // in-range lag is the doubled period, so the detector reports ~120 BPM.
    const { bpm } = detect(240, 100, 180);
    expect(bpm).toBeGreaterThanOrEqual(118);
    expect(bpm).toBeLessThanOrEqual(122);
  });

  it('returns no tempo when the beat period is outside the window', () => {
    // 60 BPM (period 1 s) with a 70-180 window has no in-range period; the
    // autocorrelation is flat and the detector must not invent a reading.
    const result = detectTempo(clickTrack(60, 12), 44100, { minBpm: 70, maxBpm: 180 });
    expect(result.bpm).toBe(0);
    expect(result.confidence).toBeLessThan(0.05);
  });

  it('returns a high confidence for a clean click track', () => {
    const { confidence } = detect(120);
    expect(confidence).toBeGreaterThan(0.5);
  });

  it('returns zero for an empty signal', () => {
    const result = detectTempo(new Float32Array(0), 44100, { minBpm: 70, maxBpm: 180 });
    expect(result.bpm).toBe(0);
    expect(result.confidence).toBe(0);
  });
});

describe('bpm/lag conversion', () => {
  it('converts lag to bpm and back', () => {
    expect(bpmFromLag(43, 86.1328125)).toBeCloseTo(120.18, 0);
    expect(lagFromBpm(120, 86.1328125)).toBeCloseTo(43.07, 1);
  });
});

/* -------------------------------------------------------------------------- */
/*  Mono mix                                                                  */
/* -------------------------------------------------------------------------- */

describe('monoMix', () => {
  it('averages channels element-wise', () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([3, 4, 5]);
    const m = monoMix([a, b]);
    expect(Array.from(m)).toEqual([2, 3, 4]);
  });

  it('returns an empty array for no channels', () => {
    expect(monoMix([]).length).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  Tap tempo                                                                 */
/* -------------------------------------------------------------------------- */

describe('tap tempo', () => {
  it('rejects an implausibly fast first interval and starts a fresh run', () => {
    const taps = addTap([], 1000);
    const after = addTap(taps, 1050); // 50 ms apart → ~1200 BPM, out of range
    expect(after).toEqual([1050]);
  });

  it('averages evenly spaced taps to the expected bpm', () => {
    let taps: number[] = [];
    const start = 1000;
    for (let i = 0; i < 8; i++) taps = addTap(taps, start + i * 500); // 120 BPM
    expect(averageTapTempo(taps)).toBe(120);
  });

  it('is robust to a single mis-timed tap', () => {
    let taps: number[] = [];
    const start = 1000;
    for (let i = 0; i < 8; i++) taps = addTap(taps, start + i * 500);
    // The ninth beat falls at 5000 ms but is tapped 300 ms late.
    taps = addTap(taps, 5300);
    expect(averageTapTempo(taps)).toBe(120);
  });

  it('needs two taps before reporting a tempo', () => {
    expect(averageTapTempo([])).toBe(0);
    expect(averageTapTempo([1000])).toBe(0);
  });

  it('builds a helpful status line', () => {
    expect(tapStatus([])).toBe('0 taps — keep tapping');
    expect(tapStatus([1000, 1500])).toMatch(/120 BPM/);
  });

  it('gives confidence that rises with more taps and caps at 1', () => {
    expect(tapConfidence([])).toBe(0);
    expect(tapConfidence([1000])).toBe(0);
    expect(tapConfidence([1000, 1500, 2000, 2500, 3000])).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/*  Report                                                                    */
/* -------------------------------------------------------------------------- */

describe('tempoReport', () => {
  it('renders the bpm and confidence into text', () => {
    const r = tempoReport({ bpm: 120, confidence: 0.9, lag: 43 });
    expect(r.render).toBe('text');
    expect(r.output).toContain('120');
    expect(r.output).toContain('90%');
    expect(r.stats?.confidence).toBe('90%');
  });

  it('notes the doubling alternative', () => {
    const r = tempoReport({ bpm: 60, confidence: 0.8, lag: 43, alternate: 120, alternateKind: 'double' });
    expect(r.output).toContain('double time');
    expect(r.notes?.join(' ')).toContain('120 BPM');
  });

  it('warns on low confidence', () => {
    const r = tempoReport({ bpm: 130, confidence: 0.2, lag: 40 });
    expect(r.notes?.join(' ')).toMatch(/low confidence/i);
  });
});