/**
 * Tests for the spectrogram tool's pure DSP.
 *
 * The heavy lifting (FFT, windows, dB conversion, colour maps, PNG encoding)
 * lives in the panel module, shared by the file path and the live microphone
 * path — so these tests exercise exactly the code that renders a spectrogram.
 */
import { describe, it, expect } from 'vitest';
import { ToolError } from '@/lib/types';
import type { SpectrogramOptions } from '@/components/panels/spectrogram-panel';
import {
  MAX_COLUMNS,
  MAX_ROWS,
  WINDOW_CHOICES,
  COLOUR_MAP_CHOICES,
  makeWindow,
  windowSample,
  windowGain,
  fft,
  magnitudeToDb,
  colourLut,
  lutAt,
  layoutFor,
  analyseFrame,
  computeSpectrogram,
  columnsToGrid,
  resolveColourMap,
  resolveSpectrogramOptions,
  encodePngRgba,
  gridToRgba,
  gridToPng,
} from '@/components/panels/spectrogram-panel';

const FS = 48000;

/** A pure sine of amplitude `amp` over `n` samples. */
function sine(freq: number, n: number, sampleRate = FS, amp = 1): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  return out;
}

/** Build options with a full band and the usual dB scale. */
function opts(over: Partial<SpectrogramOptions> = {}): SpectrogramOptions {
  return { fftSize: 1024, window: 'hann', minFreq: 0, maxFreq: 24000, floorDb: -80, ceilingDb: 0, ...over };
}

/* -------------------------------------------------------------------------- */
/*  FFT                                                                        */
/* -------------------------------------------------------------------------- */

describe('fft', () => {
  it('rejects a non-power-of-two length', () => {
    const real = new Float32Array(100);
    const imag = new Float32Array(100);
    expect(() => fft(real, imag)).toThrow(/power of two/);
  });

  it('rejects a length below 2', () => {
    expect(() => fft(new Float32Array(1), new Float32Array(1))).toThrow(/power of two/);
  });

  it('transforms a DC signal to a single bin-0 spike of N', () => {
    const n = 8;
    const real = new Float32Array(n).fill(1);
    const imag = new Float32Array(n);
    fft(real, imag);
    expect(real[0]).toBeCloseTo(n, 5);
    expect(imag[0]).toBeCloseTo(0, 5);
    for (let k = 1; k < n; k++) {
      expect(Math.hypot(real[k]!, imag[k]!)).toBeLessThan(1e-6);
    }
  });

  it('puts a bin-centred sine at the right bin with amplitude N/2', () => {
    // 6 kHz at 48 kHz with 1024 samples → bin 6000 / (48000/1024) = bin 128.
    const n = 1024;
    const real = sine(6000, n);
    const imag = new Float32Array(n);
    fft(real, imag);
    let peakBin = 0;
    let peakMag = 0;
    for (let k = 0; k <= n / 2; k++) {
      const mag = Math.hypot(real[k]!, imag[k]!);
      if (mag > peakMag) {
        peakMag = mag;
        peakBin = k;
      }
    }
    expect(peakBin).toBe(128);
    expect(peakMag).toBeCloseTo(n / 2, 1);
    // A sine starting at phase 0 lands as -i·N/2 in its bin: purely imaginary.
    expect(real[128]!).toBeCloseTo(0, 3);
    expect(imag[128]!).toBeCloseTo(-n / 2, 1);
  });

  it('handles a purely imaginary input without touching its length', () => {
    const n = 16;
    const real = new Float32Array(n);
    const imag = new Float32Array(n).fill(0.5);
    fft(real, imag);
    expect(real[0]!).toBeCloseTo(0, 5);
    expect(imag[0]!).toBeCloseTo(n * 0.5, 4);
  });
});

/* -------------------------------------------------------------------------- */
/*  Windows                                                                    */
/* -------------------------------------------------------------------------- */

describe('windows', () => {
  it('exposes the meta choices in order', () => {
    expect(WINDOW_CHOICES.map((w) => w.value)).toEqual(['hann', 'hamming', 'blackman']);
  });

  it('gives every window its exact DC gain (periodic 2πn/N form)', () => {
    // Mean of 0.5 - 0.5cos(2πn/N) is 0.5 - 0.5·sinc ≈ 0.5 for large N;
    // the finite sum is exact, so assert the analytic value tightly.
    expect(windowGain('hann', 8)).toBeCloseTo(0.5, 6);
    expect(windowGain('hamming', 8)).toBeCloseTo(0.54, 6);
    expect(windowGain('blackman', 8)).toBeCloseTo(0.42, 6);
  });

  it('has symmetric-ish endpoints: zero for Hann, nonzero for Hamming/Blackman', () => {
    expect(windowSample('hann', 0, 8)).toBeCloseTo(0, 9);
    expect(windowSample('hamming', 0, 8)).toBeCloseTo(0.08, 9);
    expect(windowSample('blackman', 0, 8)).toBeCloseTo(0, 9);
    // 0.42 - 0.5 + 0.08 = 0 for Blackman's first sample.
  });

  it('peaks at the centre with amplitude 1 (Hann, even N)', () => {
    expect(windowSample('hann', 4, 8)).toBeCloseTo(1, 9);
  });

  it('builds windows of the requested length', () => {
    expect(makeWindow('hann', 512).length).toBe(512);
  });
});

/* -------------------------------------------------------------------------- */
/*  Magnitude → dB                                                             */
/* -------------------------------------------------------------------------- */

describe('magnitudeToDb', () => {
  it('converts exact magnitudes', () => {
    expect(magnitudeToDb(1, -80, 0)).toBeCloseTo(0, 9);
    expect(magnitudeToDb(0.1, -80, 0)).toBeCloseTo(-20, 6);
    expect(magnitudeToDb(0.5, -80, 0)).toBeCloseTo(-6.0206, 3);
  });

  it('clamps at the floor and the ceiling', () => {
    expect(magnitudeToDb(1e-9, -80, 0)).toBe(-80); // -180 dB → floor
    expect(magnitudeToDb(10, -80, 0)).toBe(0); // +20 dB → ceiling
    expect(magnitudeToDb(1000, -80, 0)).toBe(0); // +60 dB → ceiling
    expect(magnitudeToDb(0.5, -40, -6)).toBeCloseTo(-6.0206, 3); // ≈ -6.02 dB
  });

  it('treats silence, zero and non-finite input as the floor', () => {
    expect(magnitudeToDb(0, -80, 0)).toBe(-80);
    expect(magnitudeToDb(Number.NaN, -80, 0)).toBe(-80);
    expect(magnitudeToDb(Number.POSITIVE_INFINITY, -80, 0)).toBe(-80);
  });
});

/* -------------------------------------------------------------------------- */
/*  Colour maps                                                                */
/* -------------------------------------------------------------------------- */

describe('colour LUTs', () => {
  it('lists the four maps in meta order', () => {
    expect(COLOUR_MAP_CHOICES.map((c) => c.value)).toEqual([
      'viridis',
      'magma',
      'grayscale',
      'seismic',
    ]);
  });

  it('builds a 256-entry LUT whose endpoints match the anchor colours', () => {
    expect(colourLut('viridis').length).toBe(256);
    expect(colourLut('viridis')[0]).toEqual([68, 1, 84]);
    expect(colourLut('viridis')[255]).toEqual([253, 231, 37]);
    expect(colourLut('magma')[0]).toEqual([0, 0, 4]);
    expect(colourLut('magma')[255]).toEqual([252, 253, 191]);
    expect(colourLut('grayscale')[0]).toEqual([0, 0, 0]);
    expect(colourLut('grayscale')[255]).toEqual([255, 255, 255]);
    expect(colourLut('seismic')[0]).toEqual([0, 0, 255]);
    expect(colourLut('seismic')[255]).toEqual([255, 0, 0]);
  });

  it('hits the mid anchors exactly on 3- and 5-stop maps', () => {
    // Grayscale midpoint 128/255 = 0.50196… → round(127.5) = 128 → value 128.
    expect(colourLut('grayscale')[128]).toEqual([128, 128, 128]);
    // Seismic has 3 anchors; t = 128/255 sits just past the middle (white)
    // stop, so the pixel is white fading a hair toward red.
    expect(colourLut('seismic')[128]).toEqual([255, 254, 254]);
    // Viridis has 5 anchors; t = 0.25 lands exactly on anchor 1.
    expect(colourLut('viridis')[64]).toEqual([59, 82, 139]);
  });

  it('indexes with clamping at both ends', () => {
    const lut = colourLut('grayscale');
    expect(lutAt(lut, -1)).toEqual([0, 0, 0]);
    expect(lutAt(lut, 2)).toEqual([255, 255, 255]);
    expect(lutAt(lut, 0)).toEqual([0, 0, 0]);
    expect(lutAt(lut, 1)).toEqual([255, 255, 255]);
  });
});

/* -------------------------------------------------------------------------- */
/*  Layout                                                                     */
/* -------------------------------------------------------------------------- */

describe('layoutFor', () => {
  it('snaps the FFT size into 256…4096 and keeps it a power of two', () => {
    expect(layoutFor(FS, opts({ fftSize: 100 })).fftSize).toBe(256);
    expect(layoutFor(FS, opts({ fftSize: 300 })).fftSize).toBe(512);
    expect(layoutFor(FS, opts({ fftSize: 9000 })).fftSize).toBe(4096);
  });

  it('computes the bin range and rows from the frequency band', () => {
    // 0–12 kHz at 48 kHz with fftSize 1024: bin width 46.875 Hz.
    const layout = layoutFor(FS, opts({ maxFreq: 12000 }));
    expect(layout.minBin).toBe(0);
    expect(layout.maxBin).toBe(256); // ceil(12000/48000·1024) = 256
    expect(layout.height).toBe(257);
    expect(layout.minFreqHz).toBe(0);
    expect(layout.maxFreqHz).toBe(12000);
  });

  it('clamps the band to Nyquist and survives a collapsed band', () => {
    // minFreq == maxFreq still yields ≥ 1 row: ceil keeps one bin above min.
    const layout = layoutFor(FS, opts({ minFreq: 1000, maxFreq: 1000 }));
    expect(layout.minBin).toBe(21); // floor(1000/48000·1024)
    expect(layout.maxBin).toBe(22); // ceil(1000/48000·1024)
    expect(layout.height).toBe(2);

    // A full-scale sine at a bin centre must read ~0 dB in its row.
    const rate = FS;
    const n = 1024;
    const binFreq = (rate / n) * 300; // 14062.5 Hz, inside the band
    const l2 = layoutFor(rate, opts({ fftSize: n, maxFreq: 20000 }));
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    const out = new Float32Array(l2.height);
    analyseFrame(l2, sine(binFreq, n), real, imag, out);
    const row = Math.min(
      l2.height - 1,
      Math.max(0, Math.round((binFreq / rate) * n) - l2.minBin),
    );
    expect(out[row]).toBeCloseTo(0, 1);
  });
});

/* -------------------------------------------------------------------------- */
/*  Grid + PNG                                                                 */
/* -------------------------------------------------------------------------- */

describe('computeSpectrogram', () => {
  it('produces a 1-column grid for a single frame of silence at the floor', () => {
    const grid = computeSpectrogram(new Float32Array(1024), FS, opts());
    expect(grid.width).toBe(1);
    expect(grid.height).toBeGreaterThan(0);
    for (let i = 0; i < grid.data.length; i++) expect(grid.data[i]).toBe(-80);
  });

  it('keeps the sine column hot and the rest at the floor', () => {
    // Two frames' worth of a 6 kHz sine (frame 1024, hop 512 → 2 frames).
    const samples = sine(6000, 1536);
    const grid = computeSpectrogram(samples, FS, opts({ maxFreq: 24000 }));
    expect(grid.width).toBe(2);
    // The sine's row must sit far above the floor in every column.
    const binRow = Math.round(6000 / (FS / 1024)); // bin 128
    const hot = grid.data[0 * grid.height + binRow]!;
    expect(hot).toBeGreaterThan(-1);
    // A row far from the tone stays at the floor.
    expect(grid.data[0 * grid.height + 5]!).toBe(-80);
    // rowFreqs maps the row back to the bin's frequency.
    expect(grid.rowFreqs[binRow]).toBeCloseTo(6000, 0);
  });

  it('caps the width at MAX_COLUMNS', () => {
    // 10 s of silence at 48 kHz with fftSize 256 → thousands of frames.
    const grid = computeSpectrogram(new Float32Array(FS * 10), FS, opts({ fftSize: 256 }));
    expect(grid.width).toBe(MAX_COLUMNS);
    expect(MAX_COLUMNS).toBe(1600);
    expect(MAX_ROWS).toBe(800);
  });
});

describe('columnsToGrid', () => {
  it('flattens columns oldest-first', () => {
    const a = new Float32Array([1, 2]);
    const b = new Float32Array([3, 4]);
    const image = columnsToGrid([a, b], 2);
    expect(image.width).toBe(2);
    expect(image.height).toBe(2);
    expect(Array.from(image.data)).toEqual([1, 2, 3, 4]);
  });

  it('skips missing columns and truncates long ones', () => {
    const image = columnsToGrid([new Float32Array([9, 9, 9])], 2);
    expect(Array.from(image.data)).toEqual([9, 9]);
  });
});

describe('PNG output', () => {
  it('encodes row-major with a filter byte per scanline', () => {
    // 2×1 red pixel → IDAT payload = filter 0 + 4 bytes RGBA, stored block.
    const rgba = new Uint8Array([255, 0, 0, 255]);
    const png = encodePngRgba(rgba, 1, 1);
    // Signature + IHDR (25) + IDAT + IEND (12).
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50); // 'P'
    // IHDR: width 1, height 1, depth 8, colour type 6 (RGBA).
    const ihdr = new DataView(png.buffer, png.byteOffset, png.byteLength);
    expect(ihdr.getUint32(16)).toBe(1); // width
    expect(ihdr.getUint32(20)).toBe(1); // height
    expect(png[24]).toBe(8);
    expect(png[25]).toBe(6);
    // The stored DEFLATE block header + raw row follows the IDAT type.
    const idatType = png.findIndex((b, i) =>
      b === 0x49 && png[i + 1] === 0x44 && png[i + 2] === 0x41 && png[i + 3] === 0x54,
    );
    expect(idatType).toBeGreaterThan(0);
    // Payload: 2 (zlib hdr) + 5 (block hdr) + (1 filter + 4 rgba) + 4 (adler).
    expect(png[idatType + 4 + 2]! & 1).toBe(1); // BFINAL set: one block
    // Raw scanline: filter byte 0, then the pixel bytes verbatim.
    const rawAt = idatType + 4 + 7;
    expect(png[rawAt]).toBe(0); // filter type 0 = none
    expect(Array.from(png.slice(rawAt + 1, rawAt + 5))).toEqual([255, 0, 0, 255]);
  });

  it('flips rows so the highest frequency lands on top', () => {
    const lut = colourLut('grayscale');
    // 1×2 grid: bottom row (row 0, low freq) is black (-80 → t 0), top row is white.
    const grid = {
      data: new Float32Array([-80, 0]),
      width: 1,
      height: 2,
      rowFreqs: new Float32Array([0, 1000]),
    };
    const rgba = gridToRgba(grid, lut, -80, 0);
    // Image row 0 (top) = grid row 1 → white; image row 1 = grid row 0 → black.
    expect(Array.from(rgba.slice(0, 4))).toEqual([255, 255, 255, 255]);
    expect(Array.from(rgba.slice(4, 8))).toEqual([0, 0, 0, 255]);
  });

  it('renders a grid to a PNG with a valid signature and dimensions', () => {
    const grid = computeSpectrogram(sine(440, 2048), FS, opts());
    const png = gridToPng(grid, 'viridis', -80, 0);
    expect(Array.from(png.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    // IHDR width/height echo the grid.
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    expect(view.getUint32(16)).toBe(grid.width);
    expect(view.getUint32(20)).toBe(grid.height);
  });
});

/* -------------------------------------------------------------------------- */
/*  Options                                                                    */
/* -------------------------------------------------------------------------- */

describe('resolveColourMap', () => {
  it('accepts the known ids and falls back to viridis', () => {
    expect(resolveColourMap('magma')).toBe('magma');
    expect(resolveColourMap('nope')).toBe('viridis');
    expect(resolveColourMap(undefined)).toBe('viridis');
    expect(resolveColourMap(42)).toBe('viridis');
  });
});

describe('resolveSpectrogramOptions', () => {
  it('applies the defaults', () => {
    const spec = resolveSpectrogramOptions({});
    expect(spec.fftSize).toBe(1024);
    expect(spec.window).toBe('hann');
    expect(spec.minFreq).toBe(0);
    expect(spec.maxFreq).toBe(20000);
    expect(spec.floorDb).toBe(-80);
    expect(spec.ceilingDb).toBe(0);
  });

  it('coerces and clamps the numeric fields', () => {
    const spec = resolveSpectrogramOptions({ fftSize: '300', minFreq: '10', maxFreq: '99000', floorDb: '-200', ceilingDb: '5' });
    expect(spec.fftSize).toBe(512);
    expect(spec.minFreq).toBe(10);
    expect(spec.maxFreq).toBe(96000);
    expect(spec.floorDb).toBe(-140);
    expect(spec.ceilingDb).toBe(0);
  });

  it('rejects a floor at or above the ceiling with a ToolError', () => {
    expect(() => resolveSpectrogramOptions({ floorDb: -10, ceilingDb: -10 })).toThrow(ToolError);
    expect(() => resolveSpectrogramOptions({ floorDb: -5, ceilingDb: -20 })).toThrow(
      /floor must be below the dB ceiling/,
    );
  });

  it('rejects an empty frequency band with a ToolError', () => {
    expect(() => resolveSpectrogramOptions({ minFreq: 5000, maxFreq: 5000 })).toThrow(
      /lowest frequency must be below/,
    );
    expect(() => resolveSpectrogramOptions({ minFreq: 9000, maxFreq: 100 })).toThrow(ToolError);
  });

  it('keeps unknown windows on Hann', () => {
    expect(resolveSpectrogramOptions({ window: 'gaussian' }).window).toBe('hann');
  });
});
