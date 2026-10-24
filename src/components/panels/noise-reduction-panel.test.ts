import { afterEach, describe, expect, it } from 'vitest';
import {
  DENOISE_FRAME_SIZE,
  DENOISE_SAMPLE_RATE,
  blendPcm,
  computePeaks,
  framePcm16k,
  loadRNNoiseDenoiser,
  processFrames,
  setDenoiserFactory,
  unframePcm16k,
  waveformComparisonSvg,
  writeNoiseReductionWav,
  type DenoiseFactory,
} from './noise-reduction-panel';

/** Wrap a per-frame function into a seam factory that hands out fresh states. */
const factoryOf =
  (process: (frame: Float32Array) => Float32Array<ArrayBuffer>): DenoiseFactory =>
  () => ({
    process,
    close: () => {},
  });

/** A denoiser that returns the frame unchanged — the neutral seam. */
const identity = factoryOf((frame) => frame.slice(0));
/** A denoiser that halves every sample — easy to assert against. */
const halve = factoryOf((frame) => {
  const out = new Float32Array(frame.length);
  for (let i = 0; i < frame.length; i++) out[i] = frame[i]! / 2;
  return out;
});
/** A denoiser that zeroes the even-indexed samples. */
const zeroEvens = factoryOf((frame) => {
  const out = frame.slice(0);
  for (let i = 0; i < out.length; i += 2) out[i] = 0;
  return out;
});

const ramp = (n: number): Float32Array => Float32Array.from({ length: n }, (_, i) => i / n);

describe('framePcm16k', () => {
  it('splits an exact multiple of 480 into whole frames', () => {
    const frames = framePcm16k(ramp(DENOISE_FRAME_SIZE * 3));
    expect(frames).toHaveLength(3);
    expect(frames[0]).toHaveLength(DENOISE_FRAME_SIZE);
    expect(frames[2]!.at(-1)).toBeCloseTo(
      (DENOISE_FRAME_SIZE * 3 - 1) / (DENOISE_FRAME_SIZE * 3),
      6,
    );
  });

  it('zero-pads a partial final frame to a full 480 samples', () => {
    const total = DENOISE_FRAME_SIZE + 100;
    const frames = framePcm16k(ramp(total));
    expect(frames).toHaveLength(2);
    expect(frames[1]).toHaveLength(DENOISE_FRAME_SIZE);
    // The 100 real samples are kept, the remaining 380 are silent padding.
    expect(frames[1]![99]).toBeCloseTo(579 / total, 6);
    expect(frames[1]![100]).toBe(0);
    expect(frames[1]![479]).toBe(0);
  });

  it('produces a single padded frame when shorter than 480 samples', () => {
    const frames = framePcm16k(ramp(10));
    expect(frames).toHaveLength(1);
    expect(frames[0]).toHaveLength(DENOISE_FRAME_SIZE);
    expect(frames[0]![9]).toBeCloseTo(9 / 10, 6);
    expect(frames[0]![10]).toBe(0);
  });

  it('returns no frames for empty input', () => {
    expect(framePcm16k(new Float32Array(0))).toEqual([]);
  });
});

describe('unframePcm16k', () => {
  it('reassembles frames and keeps only the requested sample count', () => {
    const frames = framePcm16k(ramp(DENOISE_FRAME_SIZE + 100));
    const out = unframePcm16k(frames, DENOISE_FRAME_SIZE + 100);
    expect(out).toHaveLength(DENOISE_FRAME_SIZE + 100);
    expect(out[99]).toBeCloseTo(99 / (DENOISE_FRAME_SIZE + 100), 6);
    expect(out[DENOISE_FRAME_SIZE + 99]).toBeCloseTo(
      (DENOISE_FRAME_SIZE + 99) / (DENOISE_FRAME_SIZE + 100),
      6,
    );
  });

  it('zero-fills when there are fewer frames than samples requested', () => {
    const out = unframePcm16k([Float32Array.of(1, 1, 1)], 5);
    expect(Array.from(out)).toEqual([1, 1, 1, 0, 0]);
  });
});

describe('blendPcm', () => {
  const original = Float32Array.of(0, 1, -1, 0.5);
  const denoised = Float32Array.of(1, 0, 0, -0.5);

  it('returns the original at strength 0', () => {
    expect(Array.from(blendPcm(original, denoised, 0))).toEqual([0, 1, -1, 0.5]);
  });

  it('returns the denoised signal at strength 1', () => {
    expect(Array.from(blendPcm(original, denoised, 1))).toEqual([1, 0, 0, -0.5]);
  });

  it('averages the two at strength 0.5', () => {
    expect(Array.from(blendPcm(original, denoised, 0.5))).toEqual([0.5, 0.5, -0.5, 0]);
  });

  it('clamps a strength outside 0..1', () => {
    expect(Array.from(blendPcm(original, denoised, 5))).toEqual([1, 0, 0, -0.5]);
    expect(Array.from(blendPcm(original, denoised, -2))).toEqual([0, 1, -1, 0.5]);
  });

  it('stops at the shorter of the two inputs', () => {
    const out = blendPcm(Float32Array.of(1, 1, 1), Float32Array.of(1, 1), 1);
    expect(out).toHaveLength(2);
  });
});

describe('processFrames', () => {
  it('is the identity when the denoiser and the blend keep the signal', () => {
    const pcm = ramp(DENOISE_FRAME_SIZE * 2 + 5);
    const out = processFrames(pcm, identity, 1, 1);
    expect(out).toHaveLength(pcm.length);
    for (let i = 0; i < pcm.length; i++) expect(out[i]).toBeCloseTo(pcm[i]!, 6);
  });

  it('returns the original when strength is 0, whatever the denoiser does', () => {
    const pcm = ramp(DENOISE_FRAME_SIZE + 3);
    const out = processFrames(pcm, zeroEvens, 3, 0);
    for (let i = 0; i < pcm.length; i++) expect(out[i]).toBeCloseTo(pcm[i]!, 6);
  });

  it('applies the denoiser once per pass', () => {
    const pcm = ramp(DENOISE_FRAME_SIZE);
    const once = processFrames(pcm, zeroEvens, 1, 1);
    const twice = processFrames(pcm, zeroEvens, 2, 1);
    // Both passes hit even indices, so the result is the same either way.
    expect(Array.from(once)).toEqual(Array.from(twice));
    // But a halving denoiser compounds: 1 pass = /2, 2 passes = /4.
    const half1 = processFrames(pcm, halve, 1, 1);
    const half2 = processFrames(pcm, halve, 2, 1);
    expect(half1[10]).toBeCloseTo(pcm[10]! / 2, 6);
    expect(half2[10]).toBeCloseTo(pcm[10]! / 4, 6);
  });

  it('creates one denoiser state per pass and always closes it', () => {
    let created = 0;
    let closed = 0;
    const factory: DenoiseFactory = () => {
      created++;
      return {
        process: (frame) => frame.slice(0),
        close: () => {
          closed++;
        },
      };
    };
    processFrames(ramp(DENOISE_FRAME_SIZE * 2), factory, 3, 1);
    expect(created).toBe(3);
    expect(closed).toBe(3);
  });

  it('feeds a pass its frames in order', () => {
    const seen: number[] = [];
    const factory: DenoiseFactory = () => ({
      process: (frame) => {
        seen.push(frame[0]!);
        return frame.slice(0);
      },
      close: () => {},
    });
    const pcm = ramp(DENOISE_FRAME_SIZE * 2);
    processFrames(pcm, factory, 1, 1);
    expect(seen).toHaveLength(2);
    expect(seen[0]).toBeCloseTo(pcm[0]!, 6);
    expect(seen[1]).toBeCloseTo(pcm[DENOISE_FRAME_SIZE]!, 6);
  });

  it('treats a non-positive pass count as a single pass', () => {
    const pcm = ramp(DENOISE_FRAME_SIZE);
    expect(Array.from(processFrames(pcm, halve, 0, 1))).toEqual(
      Array.from(processFrames(pcm, halve, 1, 1)),
    );
  });

  it('returns an empty track for empty input', () => {
    expect(processFrames(new Float32Array(0), identity, 1, 1)).toHaveLength(0);
  });
});

describe('writeNoiseReductionWav', () => {
  it('writes a canonical 16 kHz mono 16-bit PCM header', async () => {
    const pcm = Float32Array.of(0.5, -1, 0);
    const blob = writeNoiseReductionWav(pcm);
    expect(blob.type).toBe('audio/wav');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes.length).toBe(44 + pcm.length * 2);
    const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
    expect(ascii(0, 4)).toBe('RIFF');
    expect(ascii(8, 12)).toBe('WAVE');
    expect(ascii(12, 16)).toBe('fmt ');
    expect(ascii(36, 40)).toBe('data');
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(4, true)).toBe(bytes.length - 8); // RIFF size
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(DENOISE_SAMPLE_RATE);
    expect(view.getUint32(28, true)).toBe(DENOISE_SAMPLE_RATE * 2); // byte rate
    expect(view.getUint16(32, true)).toBe(2); // block align
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
    expect(view.getUint32(40, true)).toBe(pcm.length * 2); // data size
    expect(view.getInt16(44, true)).toBe(16384); // 0.5
    expect(view.getInt16(46, true)).toBe(-32768); // -1
    expect(view.getInt16(48, true)).toBe(0);
  });

  it('writes an empty data chunk for an empty track', async () => {
    const bytes = new Uint8Array(await writeNoiseReductionWav(new Float32Array(0)).arrayBuffer());
    expect(bytes.length).toBe(44);
    expect(new DataView(bytes.buffer).getUint32(40, true)).toBe(0);
  });
});

describe('computePeaks', () => {
  it('finds the loudest absolute sample per column', () => {
    const pcm = Float32Array.of(0.1, -0.4, 0.2, 0.9);
    expect(computePeaks(pcm, 2)).toEqual([0.4, 0.9]);
  });

  it('fills every column for short input and returns zeros for empty input', () => {
    expect(computePeaks(Float32Array.of(0.5), 4)).toEqual([0.5, 0, 0, 0]);
    expect(computePeaks(new Float32Array(0), 3)).toEqual([0, 0, 0]);
  });
});

describe('waveformComparisonSvg', () => {
  it('returns an SVG data URL with two traces', () => {
    const url = waveformComparisonSvg(
      ramp(DENOISE_FRAME_SIZE),
      ramp(DENOISE_FRAME_SIZE).map((v) => v / 4),
    );
    expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true);
    const svg = atob(url.slice('data:image/svg+xml;base64,'.length));
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('Before and after waveform comparison');
    // One path per signal.
    expect((svg.match(/<path /g) ?? []).length).toBe(2);
  });

  it('is ASCII so btoa can encode it', () => {
    const svg = atob(
      waveformComparisonSvg(ramp(100), ramp(100)).slice('data:image/svg+xml;base64,'.length),
    );
    // eslint-disable-next-line no-control-regex -- asserting ASCII-only output needs the control range
    expect(/^[\x00-\x7f]*$/.test(svg)).toBe(true);
  });
});

describe('denoiser seam', () => {
  afterEach(() => setDenoiserFactory(undefined));

  it('resolves the injected fake denoiser', async () => {
    setDenoiserFactory(() => Promise.resolve(halve));
    await expect(loadRNNoiseDenoiser()).resolves.toBe(halve);
  });

  it('clears back to the default loader, which can be swapped again', async () => {
    setDenoiserFactory(() => Promise.resolve(halve));
    setDenoiserFactory(undefined);
    setDenoiserFactory(() => Promise.resolve(identity));
    await expect(loadRNNoiseDenoiser()).resolves.toBe(identity);
  });
});
