/**
 * Pure spectrogram logic for the spectrogram tool.
 *
 * This module owns every computation worth testing: a real radix-2 FFT, the
 * Hann / Hamming / Blackman window functions, magnitude-to-dB conversion with
 * floor/ceiling clamping, the colour-map lookup tables and the PNG row layout
 * + encoder. None of it touches the DOM, the microphone or the network, so the
 * DSP can be unit-tested in Node/jsdom.
 *
 * The browser-only parts (the file drop zone, the microphone graph with its
 * `AnalyserNode`, and the canvas preview) live in `spectrogram-panel.ts`'s
 * `mountSpectrogramPanel` below, which hands audio to the tool's `run()` via
 * `runToolById`; the tool itself reuses every pure function here.
 */

import { ToolError } from '@/lib/types';
import type { FileRunResult, OptionValues } from '@/lib/types';
import { runToolById } from '@/lib/worker/client';
import { decodeFile } from '@/tools/audio/lib';
import {
  clearError,
  readOptions,
  renderTextResult,
  showError,
} from '../workbench/shared';

/* -------------------------------------------------------------------------- */
/*  Windows                                                                   */
/* -------------------------------------------------------------------------- */

export type WindowType = 'hann' | 'hamming' | 'blackman';

/** The window choices the tool offers, in meta order. */
export const WINDOW_CHOICES: { value: WindowType; label: string }[] = [
  { value: 'hann', label: 'Hann' },
  { value: 'hamming', label: 'Hamming' },
  { value: 'blackman', label: 'Blackman' },
];

/**
 * A symmetric-window sample at index `n` of `N`. Uses the periodic form
 * (2πn/N) so the DC gain is exact: Hann 0.5, Hamming 0.54, Blackman 0.42.
 */
export function windowSample(type: WindowType, n: number, nWindow: number): number {
  const t = (2 * Math.PI * n) / nWindow;
  switch (type) {
    case 'hamming':
      return 0.54 - 0.46 * Math.cos(t);
    case 'blackman':
      return 0.42 - 0.5 * Math.cos(t) + 0.08 * Math.cos(2 * t);
    case 'hann':
    default:
      return 0.5 - 0.5 * Math.cos(t);
  }
}

/** Build the full window of `n` samples for a given type. */
export function makeWindow(type: WindowType, n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = windowSample(type, i, n);
  return w;
}

/**
 * The DC gain of a window: the average of its samples. A windowed sine at a
 * bin centre therefore lands at `(peak amplitude) * gain` in that bin.
 */
export function windowGain(type: WindowType, n: number): number {
  const w = makeWindow(type, n);
  let sum = 0;
  for (let i = 0; i < w.length; i++) sum += w[i] ?? 0;
  return sum / n;
}

/* -------------------------------------------------------------------------- */
/*  Radix-2 FFT                                                               */
/* -------------------------------------------------------------------------- */

/**
 * In-place radix-2 iterative Cooley–Tukey FFT on `n` complex samples.
 *
 * `real` and `imag` must be `Float32Array`s of the same length `n`, and `n`
 * must be a power of two. On return the arrays hold the (unnormalised) DFT:
 * `X[k] = sum_{n} x[n] * exp(-2πi k n / N)`.
 *
 * This is a textbook decimation-in-time implementation — no libraries, no
 * external dependencies — using precomputed twiddle factors so the inner loops
 * are just adds and multiplies.
 */
export function fft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  if (n < 2 || (n & (n - 1)) !== 0) {
    throw new Error('fft: length must be a power of two and at least 2');
  }

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = real[i] ?? 0;
      real[i] = real[j] ?? 0;
      real[j] = tr;
      const ti = imag[i] ?? 0;
      imag[i] = imag[j] ?? 0;
      imag[j] = ti;
    }
  }

  // Butterfly stages. `len` doubles each stage; `len2` is the half-length.
  for (let len = 2; len <= n; len <<= 1) {
    const len2 = len >> 1;
    const ang = (-2 * Math.PI) / len; // twiddle step for this stage
    for (let i = 0; i < len2; i++) {
      const wReal = Math.cos(ang * i);
      const wImag = Math.sin(ang * i);
      for (let j = i; j < n; j += len) {
        const k = j + len2;
        const uReal = real[j] ?? 0;
        const uImag = imag[j] ?? 0;
        const vReal = (real[k] ?? 0) * wReal - (imag[k] ?? 0) * wImag;
        const vImag = (real[k] ?? 0) * wImag + (imag[k] ?? 0) * wReal;
        real[j] = uReal + vReal;
        imag[j] = uImag + vImag;
        real[k] = uReal - vReal;
        imag[k] = uImag - vImag;
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Magnitude → dB                                                            */
/* -------------------------------------------------------------------------- */

/** Convert a linear magnitude to dB, clamped to `[floorDb, ceilingDb]`. */
export function magnitudeToDb(magnitude: number, floorDb: number, ceilingDb: number): number {
  const m = Math.abs(Number(magnitude));
  if (!Number.isFinite(m) || m <= 1e-12) return floorDb;
  const db = 20 * Math.log10(m);
  if (!Number.isFinite(db)) return floorDb;
  return Math.min(ceilingDb, Math.max(floorDb, db));
}

/** Clamp a value into `[lo, hi]`, safe against NaN / reversed bounds. */
function clampNumber(value: number, lo: number, hi: number): number {
  const v = Number.isFinite(value) ? value : lo;
  const low = Math.min(lo, hi);
  const high = Math.max(lo, hi);
  return Math.min(high, Math.max(low, v));
}

/* -------------------------------------------------------------------------- */
/*  Colour maps                                                               */
/* -------------------------------------------------------------------------- */

export type ColourMapId = 'viridis' | 'magma' | 'grayscale' | 'seismic';

export const COLOUR_MAP_CHOICES: { value: ColourMapId; label: string }[] = [
  { value: 'viridis', label: 'Viridis' },
  { value: 'magma', label: 'Magma' },
  { value: 'grayscale', label: 'Grayscale' },
  { value: 'seismic', label: 'Seismic' },
];

/** Anchor stops per map: `[r, g, b]` at evenly spaced 0…1 positions. */
const MAP_ANCHORS: Record<ColourMapId, [number, number, number][]> = {
  viridis: [
    [68, 1, 84],
    [59, 82, 139],
    [33, 145, 140],
    [94, 201, 98],
    [253, 231, 37],
  ],
  magma: [
    [0, 0, 4],
    [81, 18, 124],
    [180, 55, 122],
    [253, 150, 43],
    [252, 253, 191],
  ],
  grayscale: [
    [0, 0, 0],
    [255, 255, 255],
  ],
  seismic: [
    [0, 0, 255],
    [255, 255, 255],
    [255, 0, 0],
  ],
};

/** One RGB triple per unit step, so `LUT[t]` maps a 0…1 value to a colour. */
export type ColourLut = [number, number, number][];

/** Build a colour LUT for a map id. Purely deterministic, tested by value. */
export function colourLut(id: ColourMapId): ColourLut {
  const anchors = MAP_ANCHORS[id];
  const lut: ColourLut = [];
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const scaled = t * (anchors.length - 1);
    const idx = Math.min(anchors.length - 2, Math.floor(scaled));
    const frac = scaled - idx;
    const a = anchors[idx]!;
    const b = anchors[idx + 1]!;
    lut.push([
      Math.round(a[0] + (b[0] - a[0]) * frac),
      Math.round(a[1] + (b[1] - a[1]) * frac),
      Math.round(a[2] + (b[2] - a[2]) * frac),
    ]);
  }
  return lut;
}

/** Index a LUT from a clamped 0…1 value, returning `[r, g, b]`. */
export function lutAt(lut: ColourLut, t: number): [number, number, number] {
  const i = Math.round(clampNumber(t, 0, 1) * 255);
  return lut[Math.min(255, Math.max(0, i))]!;
}

/* -------------------------------------------------------------------------- */
/*  Spectrogram grid                                                          */
/* -------------------------------------------------------------------------- */

export interface SpectrogramOptions {
  /** FFT size: a power of two in 256…4096. */
  fftSize: number;
  /** Window type applied to each frame. */
  window: WindowType;
  /** Lowest frequency to keep, Hz. */
  minFreq: number;
  /** Highest frequency to keep, Hz. */
  maxFreq: number;
  /** dB floor (bottom of the colour scale). */
  floorDb: number;
  /** dB ceiling (top of the colour scale). */
  ceilingDb: number;
}

/** A 2-D grid of dB values, `width` time columns by `height` frequency rows. */
export interface SpectrogramGrid {
  data: Float32Array;
  width: number;
  height: number;
  /** The frequency of each row (row 0 = lowest). */
  rowFreqs: Float32Array;
}

/** Largest image we ever build, so a long file cannot exhaust memory. */
export const MAX_COLUMNS = 1600;
export const MAX_ROWS = 800;

/**
 * Everything about a spectrogram that depends only on the sample rate and the
 * options: the FFT size, the window, the bin range and the dB scale. Both the
 * file path and the live microphone path build one of these, so a frame is
 * always analysed the same way.
 */
export interface SpectrogramLayout {
  fftSize: number;
  /** The window samples, `fftSize` long. */
  windowFn: Float32Array;
  /** Multiplier that makes a full-scale sine read 0 dB. */
  scale: number;
  /** First FFT bin kept. */
  minBin: number;
  /** Last FFT bin kept. */
  maxBin: number;
  /** FFT bins merged into one displayed row. */
  binsPerRow: number;
  /** Displayed rows (frequency resolution of the image). */
  height: number;
  /** dB of the bottom of the colour scale. */
  floorDb: number;
  /** dB of the top of the colour scale. */
  ceilingDb: number;
  /** Frequency of the first row, Hz. */
  minFreqHz: number;
  /** Frequency of the last row, Hz. */
  maxFreqHz: number;
  sampleRate: number;
}

/** Build the layout for a sample rate and a set of options. */
export function layoutFor(sampleRate: number, opts: SpectrogramOptions): SpectrogramLayout {
  const rate = Number.isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 1;
  const fftSize = nextPow2(clampNumber(Math.round(opts.fftSize), 256, 4096));
  const windowType = opts.window in WINDOW ? (opts.window as WindowType) : 'hann';
  const windowFn = makeWindow(windowType, fftSize);

  // The spectrum of a real signal is mirrored, so bins stop at Nyquist.
  const nyquist = rate / 2;
  const minFreq = clampNumber(opts.minFreq, 0, nyquist);
  const maxFreq = Math.min(nyquist, Math.max(minFreq, clampNumber(opts.maxFreq, 0, nyquist)));
  const minBin = Math.max(0, Math.floor((minFreq / rate) * fftSize));
  const maxBin = Math.min(
    fftSize >> 1,
    Math.max(minBin, Math.ceil((maxFreq / rate) * fftSize)),
  );
  const bins = maxBin - minBin + 1;
  const height = Math.min(MAX_ROWS, bins);

  // Normalise by the window's coherent gain and the one-sided bin scaling so a
  // full-scale sine at a bin centre reads 0 dB.
  const gain = windowGain(windowType, fftSize) * (fftSize / 2);

  return {
    fftSize,
    windowFn,
    scale: gain > 0 ? 1 / gain : 1,
    minBin,
    maxBin,
    binsPerRow: bins / height,
    height,
    floorDb: opts.floorDb,
    ceilingDb: opts.ceilingDb,
    minFreqHz: (minBin * rate) / fftSize,
    maxFreqHz: (maxBin * rate) / fftSize,
    sampleRate: rate,
  };
}

/**
 * Analyse one frame of `fftSize` samples into a dB column of `layout.height`
 * values. `real`/`imag` are scratch buffers of `fftSize` and are reused across
 * calls so the live microphone path allocates nothing per frame.
 */
export function analyseFrame(
  layout: SpectrogramLayout,
  samples: ArrayLike<number>,
  real: Float32Array,
  imag: Float32Array,
  out: Float32Array,
): Float32Array {
  const { fftSize, windowFn, scale, minBin, maxBin, binsPerRow, height } = layout;
  for (let i = 0; i < fftSize; i++) {
    real[i] = (samples[i] ?? 0) * (windowFn[i] ?? 0) * scale;
    imag[i] = 0;
  }
  fft(real, imag);

  for (let row = 0; row < height; row++) {
    const firstBin = minBin + Math.floor(row * binsPerRow);
    const lastBin = Math.min(maxBin, minBin + Math.floor((row + 1) * binsPerRow) - 1);
    let peak = 0;
    for (let bin = firstBin; bin <= lastBin; bin++) {
      const mag = Math.hypot(real[bin] ?? 0, imag[bin] ?? 0);
      if (mag > peak) peak = mag;
    }
    out[row] = magnitudeToDb(peak, layout.floorDb, layout.ceilingDb);
  }
  return out;
}

/**
 * Compute the magnitude-spectrogram of a mono signal.
 *
 * Frames hop by 50% (`fftSize/2` samples) and are laid out oldest→newest along
 * the columns, low→high frequency along the rows.
 *
 * The image is capped at `MAX_COLUMNS` × `MAX_ROWS`. When a file is longer or
 * the band is wider than that, neighbouring frames / bins are merged by taking
 * the loudest value, so peaks survive the decimation.
 */
export function computeSpectrogram(
  samples: Float32Array,
  sampleRate: number,
  opts: SpectrogramOptions,
): SpectrogramGrid {
  const layout = layoutFor(sampleRate, opts);
  const hop = Math.max(1, layout.fftSize >> 1);
  const totalFrames =
    samples.length >= layout.fftSize ? Math.floor((samples.length - layout.fftSize) / hop) + 1 : 1;

  const width = Math.min(MAX_COLUMNS, Math.max(1, totalFrames));
  const height = layout.height;
  const framesPerColumn = totalFrames / width;

  const real = new Float32Array(layout.fftSize);
  const imag = new Float32Array(layout.fftSize);
  const column = new Float32Array(height);
  const data = new Float32Array(width * height);

  for (let col = 0; col < width; col++) {
    const fromFrame = Math.floor(col * framesPerColumn);
    const toFrame = Math.min(
      totalFrames,
      Math.max(fromFrame + 1, Math.floor((col + 1) * framesPerColumn)),
    );
    // The loudest value per row across the merged frames.
    data.fill(opts.floorDb, col * height, (col + 1) * height);

    for (let frame = fromFrame; frame < toFrame; frame++) {
      const frameStart = Math.min(Math.max(0, samples.length - layout.fftSize), frame * hop);
      analyseFrame(layout, samples.subarray(frameStart), real, imag, column);
      for (let row = 0; row < height; row++) {
        const value = column[row] ?? opts.floorDb;
        const index = col * height + row;
        if (value > (data[index] ?? Number.NEGATIVE_INFINITY)) data[index] = value;
      }
    }
  }

  const rowFreqs = new Float32Array(height);
  for (let row = 0; row < height; row++) {
    rowFreqs[row] = ((layout.minBin + Math.floor(row * layout.binsPerRow)) * layout.sampleRate) /
      layout.fftSize;
  }

  return { data, width, height, rowFreqs };
}

/** Round up to the next power of two. */
function nextPow2(value: number): number {
  let p = 2;
  const v = Math.max(2, Math.round(value));
  while (p < v) p <<= 1;
  return p;
}

const WINDOW: Record<string, WindowType> = {
  hann: 'hann',
  hamming: 'hamming',
  blackman: 'blackman',
};

/* -------------------------------------------------------------------------- */
/*  Options                                                                   */
/* -------------------------------------------------------------------------- */

/** Pick a colour map id, falling back to Viridis for anything unknown. */
export function resolveColourMap(value: unknown): ColourMapId {
  const id = String(value ?? 'viridis');
  return id in MAP_ANCHORS ? (id as ColourMapId) : 'viridis';
}

/**
 * Coerce the option form's strings into a validated `SpectrogramOptions`.
 * A contradictory pair throws a `ToolError` the user can act on rather than
 * silently producing a blank image.
 */
export function resolveSpectrogramOptions(values: OptionValues): SpectrogramOptions {
  const fftSize = nextPow2(clampNumber(Number(values.fftSize ?? 1024), 256, 4096));
  const windowType = String(values.window ?? 'hann');
  const minFreq = clampNumber(Number(values.minFreq ?? 0), 0, 96000);
  const maxFreq = clampNumber(Number(values.maxFreq ?? 20000), 1, 96000);
  const floorDb = clampNumber(Number(values.floorDb ?? -80), -140, -5);
  const ceilingDb = clampNumber(Number(values.ceilingDb ?? 0), -60, 0);

  if (floorDb >= ceilingDb) {
    throw new ToolError(
      'The dB floor must be below the dB ceiling.',
      'Lower the floor or raise the ceiling so the colour scale has a range.',
    );
  }
  if (minFreq >= maxFreq) {
    throw new ToolError(
      'The lowest frequency must be below the highest frequency.',
      'Widen the frequency range, or set both to the full spectrum.',
    );
  }
  return {
    fftSize,
    window: windowType in WINDOW ? (windowType as WindowType) : 'hann',
    minFreq,
    maxFreq,
    floorDb,
    ceilingDb,
  };
}

/* -------------------------------------------------------------------------- */
/*  PNG output                                                                */
/* -------------------------------------------------------------------------- */

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** CRC-32 (PNG chunk checksum), the standard reflected polynomial. */
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ (bytes[i] ?? 0)) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Adler-32, the checksum a zlib stream ends with. */
function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + (bytes[i] ?? 0)) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** The biggest payload one stored DEFLATE block can carry. */
const DEFLATE_BLOCK = 65535;

/**
 * Wrap bytes in a zlib stream built from stored (uncompressed) DEFLATE blocks.
 * Stored blocks keep the encoder short and its output byte-for-byte
 * deterministic; a spectrogram PNG is a few hundred kilobytes, which is fine.
 */
function zlibStored(raw: Uint8Array): Uint8Array {
  const blocks = Math.max(1, Math.ceil(raw.length / DEFLATE_BLOCK));
  const out = new Uint8Array(2 + blocks * 5 + raw.length + 4);
  let o = 0;
  out[o++] = 0x78; // CMF: DEFLATE, 32 KiB window
  out[o++] = 0x01; // FLG: no preset dictionary, fastest level
  for (let block = 0; block < blocks; block++) {
    const start = block * DEFLATE_BLOCK;
    const len = Math.min(DEFLATE_BLOCK, raw.length - start);
    out[o++] = block === blocks - 1 ? 1 : 0; // BFINAL + BTYPE 00 (stored)
    out[o++] = len & 0xff;
    out[o++] = (len >>> 8) & 0xff;
    out[o++] = ~len & 0xff;
    out[o++] = (~len >>> 8) & 0xff;
    out.set(raw.subarray(start, start + len), o);
    o += len;
  }
  const sum = adler32(raw);
  out[o++] = (sum >>> 24) & 0xff;
  out[o++] = (sum >>> 16) & 0xff;
  out[o++] = (sum >>> 8) & 0xff;
  out[o++] = sum & 0xff;
  return out.subarray(0, o);
}

/** One PNG chunk: length, type, payload, CRC. */
function pngChunk(type: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + payload.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, payload.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(payload, 8);
  view.setUint32(8 + payload.length, crc32(out.subarray(4, 8 + payload.length)));
  return out;
}

/**
 * Encode 8-bit RGBA pixels as a PNG file. Row-major, top row first, no
 * interlacing and no ancillary chunks — a minimal, standards-conformant file
 * that every browser and image viewer reads.
 */
export function encodePngRgba(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const stride = w * 4;

  // Each scanline is prefixed with its filter type (0 = none).
  const raw = new Uint8Array((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    const from = y * stride;
    raw.set(rgba.subarray(from, from + stride), y * (stride + 1) + 1);
  }

  const ihdr = new Uint8Array(13);
  const header = new DataView(ihdr.buffer);
  header.setUint32(0, w);
  header.setUint32(4, h);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: truecolour with alpha
  ihdr[10] = 0; // compression: DEFLATE
  ihdr[11] = 0; // filter method: adaptive
  ihdr[12] = 0; // no interlacing

  const parts = [
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlibStored(raw)),
    pngChunk('IEND', new Uint8Array(0)),
  ];
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * Lay a spectrogram grid out as RGBA pixels for the PNG.
 *
 * The vertical axis is flipped here — the grid stores row 0 at the lowest
 * frequency (how the FFT hands it over), while an image reads top-down, so the
 * highest frequency ends up at the top of the picture.
 */
export function gridToRgba(
  grid: SpectrogramGrid,
  lut: ColourLut,
  floorDb: number,
  ceilingDb: number,
): Uint8Array {
  const { data, width, height } = grid;
  const rgba = new Uint8Array(width * height * 4);
  const span = ceilingDb - floorDb;
  for (let y = 0; y < height; y++) {
    const sourceRow = height - 1 - y;
    for (let x = 0; x < width; x++) {
      const db = data[x * height + sourceRow] ?? floorDb;
      const [r, g, b] = lutAt(lut, span > 0 ? (db - floorDb) / span : 0);
      const o = (y * width + x) * 4;
      rgba[o] = r;
      rgba[o + 1] = g;
      rgba[o + 2] = b;
      rgba[o + 3] = 255;
    }
  }
  return rgba;
}

/** Render a grid straight to PNG bytes with a colour map. */
export function gridToPng(
  grid: SpectrogramGrid,
  colourMap: ColourMapId,
  floorDb: number,
  ceilingDb: number,
): Uint8Array {
  return encodePngRgba(
    gridToRgba(grid, colourLut(colourMap), floorDb, ceilingDb),
    grid.width,
    grid.height,
  );
}

/* -------------------------------------------------------------------------- */
/*  Live capture helpers                                                      */
/* -------------------------------------------------------------------------- */

/** A bare image: the columns of a spectrogram plus its frequency resolution. */
export interface SpectrogramImage {
  /** Row-major dB values: `width` columns of `height` rows each. */
  data: Float32Array;
  width: number;
  height: number;
}

/**
 * Flatten live-capture columns (a list of `height`-long dB columns, oldest
 * first) into one image. Used by the microphone path, which appends a column
 * per animation frame instead of analysing a whole file at once.
 */
export function columnsToGrid(columns: Float32Array[], height: number): SpectrogramImage {
  const width = columns.length;
  const data = new Float32Array(width * height);
  for (let col = 0; col < width; col++) {
    const column = columns[col];
    if (!column) continue;
    data.set(column.subarray(0, height), col * height);
  }
  return { data, width, height };
}

/** How many frames the live view may hold before it starts decimating. */
export const LIVE_COLUMNS = MAX_COLUMNS;

/**
 * Mount the spectrogram panel into a `[data-spectrogram-panel]` element.
 *
 * The panel owns the browser-only work: choosing or dropping a file, opening
 * the microphone and running an `AnalyserNode`-based live spectrogram, drawing
 * the canvas, and handing the audio to the tool's own `run()` through
 * `runToolById`. The tool decodes the audio and returns the PNG, so the same
 * code path serves the file and the microphone.
 */
export function mountSpectrogramPanel(panel: HTMLElement): void {
  const errorBox = panel.querySelector<HTMLElement>('[data-spec-error]')!;
  const input = panel.querySelector<HTMLInputElement>('[data-spec-input]')!;
  const drop = panel.querySelector<HTMLElement>('[data-spec-drop]')!;
  const fileList = panel.querySelector<HTMLElement>('[data-spec-files]')!;
  const runBtn = panel.querySelector<HTMLButtonElement>('[data-spec-run]')!;
  const progressWrap = panel.querySelector<HTMLElement>('[data-spec-progress]')!;
  const progressBar = panel.querySelector<HTMLElement>('[data-spec-progress-bar]')!;
  const progressLabel = panel.querySelector<HTMLElement>('[data-spec-progress-label]')!;
  const canvas = panel.querySelector<HTMLCanvasElement>('[data-spec-canvas]')!;
  const canvasAlt = panel.querySelector<HTMLElement>('[data-spec-canvas-alt]')!;
  const micStart = panel.querySelector<HTMLButtonElement>('[data-spec-mic-start]')!;
  const micStop = panel.querySelector<HTMLButtonElement>('[data-spec-mic-stop]')!;
  const micExport = panel.querySelector<HTMLButtonElement>('[data-spec-mic-export]')!;
  const statusEl = panel.querySelector<HTMLElement>('[data-spec-status]')!;
  const legend = panel.querySelector<HTMLElement>('[data-spec-legend]')!;
  const legendFloor = panel.querySelector<HTMLElement>('[data-spec-legend-floor]')!;
  const legendCeiling = panel.querySelector<HTMLElement>('[data-spec-legend-ceiling]')!;
  const axisFreq = panel.querySelector<HTMLElement>('[data-spec-axis-freq]')!;
  const axisTime = panel.querySelector<HTMLElement>('[data-spec-axis-time]')!;
  const summary = panel.querySelector<HTMLElement>('[data-spec-summary]')!;
  const resultWrap = panel.querySelector<HTMLElement>('[data-spec-result]')!;
  const imageEl = panel.querySelector<HTMLImageElement>('[data-spec-image]')!;
  const downloadEl = panel.querySelector<HTMLAnchorElement>('[data-spec-download]')!;
  const statsEl = panel.querySelector<HTMLElement>('[data-spec-stats]')!;
  const notesEl = panel.querySelector<HTMLElement>('[data-spec-notes]')!;
  const optionsRoot = panel.querySelector<HTMLElement>('[data-spec-options]')!;

  if (
    !errorBox ||
    !input ||
    !drop ||
    !fileList ||
    !runBtn ||
    !progressWrap ||
    !progressBar ||
    !progressLabel ||
    !canvas ||
    !canvasAlt ||
    !micStart ||
    !micStop ||
    !micExport ||
    !statusEl ||
    !legend ||
    !legendFloor ||
    !legendCeiling ||
    !axisFreq ||
    !axisTime ||
    !summary ||
    !resultWrap ||
    !imageEl ||
    !downloadEl ||
    !statsEl ||
    !notesEl ||
    !optionsRoot
  ) {
    return;
  }

  let chosenFile: File | null = null;
  let resultUrl: string | null = null;

  /** The raw option values as the form holds them (strings and numbers). */
  const optionValues = (): OptionValues => readOptions(optionsRoot);

  /** Validate the options, reporting the problem in the panel instead of throwing. */
  function readSpec(): { spec: SpectrogramOptions; colourMap: ColourMapId } | null {
    try {
      return { spec: resolveSpectrogramOptions(optionValues()), colourMap: resolveColourMap(optionValues().colourMap) };
    } catch (error) {
      const err = error as Error & { hint?: string };
      showError(errorBox, err.message, err.hint);
      return null;
    }
  }

  function announce(message: string): void {
    statusEl.textContent = message;
  }

  const escape = (value: string): string =>
    value.replace(/[&<>"']/g, (c) =>
      c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
    );

  function chooseFile(file: File): void {
    chosenFile = file;
    fileList!.replaceChildren();
    const li = document.createElement('li');
    li.textContent = file.name;
    fileList!.appendChild(li);
    runBtn!.disabled = false;
    announce(`Ready to analyse ${file.name}.`);
  }

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) chooseFile(file);
  });

  for (const type of ['dragenter', 'dragover'] as const) {
    drop.addEventListener(type, (event) => {
      event.preventDefault();
      drop.dataset.dragging = 'true';
    });
  }
  for (const type of ['dragleave', 'drop'] as const) {
    drop.addEventListener(type, () => delete drop.dataset.dragging);
  }
  drop.addEventListener('drop', (event) => {
    event.preventDefault();
    const file = (event as DragEvent).dataTransfer?.files?.[0];
    if (file) chooseFile(file);
  });

  function showProgress(fraction: number, message: string): void {
    progressWrap!.hidden = false;
    progressBar!.style.width = `${Math.round(fraction * 100)}%`;
    progressLabel!.textContent = message;
  }

  function renderNotes(result: FileRunResult): void {
    statsEl!.replaceChildren();
    for (const [key, value] of Object.entries(result.stats ?? {})) {
      const li = document.createElement('li');
      li.textContent = `${key}: ${value}`;
      statsEl!.appendChild(li);
    }
    notesEl!.replaceChildren();
    for (const warning of result.warnings ?? []) {
      const li = document.createElement('li');
      li.style.color = 'rgb(var(--warning))';
      li.textContent = `⚠ ${warning}`;
      notesEl!.appendChild(li);
    }
    for (const note of result.notes ?? []) {
      const li = document.createElement('li');
      const [head, ...rest] = note.split(' — ');
      li.innerHTML = `<strong>${escape(head ?? '')}</strong>${rest.length ? ` — ${escape(rest.join(' — '))}` : ''}`;
      notesEl!.appendChild(li);
    }
  }

  function renderFileResult(result: FileRunResult): void {
    const output = result.outputs[0];
    resultWrap!.hidden = false;
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = output ? URL.createObjectURL(output.blob) : null;
    if (resultUrl && output) {
      imageEl!.src = resultUrl;
      imageEl!.alt = `Spectrogram of ${chosenFile?.name ?? 'the audio'}`;
      imageEl!.hidden = false;
      downloadEl!.href = resultUrl;
      downloadEl!.download = output.filename;
      downloadEl!.hidden = false;
      announce(`Spectrogram ready — save ${output.filename}.`);
    }
    renderNotes(result);
  }

  async function runFile(): Promise<void> {
    if (!chosenFile) {
      showError(errorBox, 'Choose an audio file first.', 'MP3, WAV, OGG, FLAC and M4A all work.');
      return;
    }
    if (!readSpec()) return;
    clearError(errorBox);
    runBtn!.disabled = true;
    showProgress(0, 'Decoding');
    try {
      const result = await runToolById<FileRunResult>(
        'spectrogram',
        { files: [chosenFile], options: optionValues() },
        { onProgress: (fraction, message) => showProgress(fraction, message ?? 'Working') },
      );
      renderFileResult(result);
    } catch (error) {
      const err = error as Error & { hint?: string };
      showError(errorBox, err.message || 'That audio could not be analysed.', err.hint);
    } finally {
      runBtn!.disabled = false;
      progressWrap!.hidden = true;
      progressBar!.style.width = '0%';
    }
  }

  runBtn.addEventListener('click', () => void runFile());

  /* MIC:MOUNT */
  // The live microphone path: an AudioContext + AnalyserNode graph feeds the
  // canvas one column per animation frame, all analysed by the same pure
  // functions as the file path. The clip is also handed to the tool's run()
  // so the user can download a full PNG.
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let micStream: MediaStream | null = null;
  let liveLayout: SpectrogramLayout | null = null;
  let liveReal: Float32Array | null = null;
  let liveImag: Float32Array | null = null;
  let liveColumn: Float32Array | null = null;
  let liveColumns: Float32Array[] = [];
  let liveLut: ColourLut = colourLut('viridis');
  let rafId: number | null = null;
  let recording = false;

  const win = window as unknown as Record<string, unknown>;
  const CtxCtor = (typeof win.AudioContext === 'function'
    ? win.AudioContext
    : typeof win.webkitAudioContext === 'function'
      ? win.webkitAudioContext
      : null) as typeof AudioContext | null;

  function sizeCanvas(): void {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** The live view renders at most this many columns, to keep redraws cheap. */

  function optionsChanged(): void {
    const parsed = readSpec();
    if (!parsed) return;
    liveLut = colourLut(parsed.colourMap);
    if (audioCtx && analyser) {
      const layout = layoutFor(audioCtx.sampleRate, parsed.spec);
      liveLayout = layout;
      analyser.fftSize = layout.fftSize;
      liveReal = new Float32Array(layout.fftSize);
      liveImag = new Float32Array(layout.fftSize);
      liveColumn = new Float32Array(layout.height);
      legendFloor.textContent = `${parsed.spec.floorDb.toFixed(0)} dB`;
      legendCeiling.textContent = `${parsed.spec.ceilingDb.toFixed(0)} dB`;
      axisFreq.textContent = `${Math.round(layout.minFreqHz)}–${Math.round(layout.maxFreqHz)} Hz`;
    }
  }

  for (const el of optionsRoot.querySelectorAll<HTMLElement>('select, input')) {
    el.addEventListener('input', () => void optionsChanged());
    el.addEventListener('change', () => void optionsChanged());
  }

  micStart.addEventListener('click', () => {
    void (async () => {
      if (!CtxCtor) {
        showError(errorBox, 'Your browser does not support the Web Audio API.', 'Try a recent Chrome, Edge, Firefox or Safari.');
        return;
      }
      const parsed = readSpec();
      if (!parsed) return;
      clearError(errorBox);
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new CtxCtor();
        sourceNode = audioCtx.createMediaStreamSource(micStream);
        analyser = audioCtx.createAnalyser();
        analyser.smoothingTimeConstant = 0;
        const layout = layoutFor(audioCtx.sampleRate, parsed.spec);
        analyser.fftSize = layout.fftSize;
        sourceNode.connect(analyser);
        analyser.connect(audioCtx.destination);
        liveLayout = layout;
        liveReal = new Float32Array(layout.fftSize);
        liveImag = new Float32Array(layout.fftSize);
        liveColumn = new Float32Array(layout.height);
        liveLut = colourLut(parsed.colourMap);
        liveColumns = [];
        recordedColumns = [];
        recording = false;
        sizeCanvas();
        legendFloor.textContent = `${parsed.spec.floorDb.toFixed(0)} dB`;
        legendCeiling.textContent = `${parsed.spec.ceilingDb.toFixed(0)} dB`;
        axisFreq.textContent = `${Math.round(layout.minFreqHz)}–${Math.round(layout.maxFreqHz)} Hz`;
        micStart.hidden = true;
        micStop.hidden = false;
        micExport.disabled = true;
        micExport.textContent = 'Export capture';
        canvas.hidden = false;
        canvasAlt.hidden = true;
        announce('Microphone on — watching the live spectrogram.');
        rafId = window.requestAnimationFrame(tick);
      } catch (error) {
        const err = error as Error & { name?: string };
        const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
        showError(
          errorBox,
          denied ? 'Microphone access was denied.' : 'The microphone could not be opened.',
          denied ? 'Allow microphone access and try again.' : 'Check that a microphone is plugged in and not in use by another app.',
        );
      }
    })();
  });

  micStop.addEventListener('click', () => {
    if (rafId !== null) window.cancelAnimationFrame(rafId);
    rafId = null;
    analyser?.disconnect();
    sourceNode?.disconnect();
    analyser = null;
    sourceNode = null;
    liveLayout = null;
    micStream?.getTracks().forEach((track) => track.stop());
    micStream = null;
    audioCtx?.close();
    audioCtx = null;
    micStart.hidden = false;
    micStop.hidden = true;
    const captured = recordedColumns.length > 0;
    micExport.disabled = !captured;
    micExport.textContent = captured ? 'Export capture' : 'No capture yet';
    announce(
      captured
        ? `Stopped — captured ${recordedColumns.length} frames. Export them as a PNG.`
        : 'Stopped — nothing captured. Press "Capture" while recording to save a PNG.',
    );
  });

  micExport.addEventListener('click', () => {
    if (recording) return;
    const parsed = readSpec();
    if (!parsed) return;
    if (recordedColumns.length === 0 || !audioCtx) {
      showError(errorBox, 'Nothing captured yet.', 'Start the microphone, press Capture, then Stop, then Export.');
      return;
    }
    // Reuse the file path: the tool decodes this WAV and builds the PNG.
    void (async () => {
      const layout = liveLayout;
      if (!layout) return;
      const image = columnsToGrid(recordedColumns, layout.height);
      const png = gridToPng(image, parsed.colourMap, parsed.spec.floorDb, parsed.spec.ceilingDb);
      const blob = new Blob([png as BlobPart], { type: 'image/png' });
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      resultUrl = URL.createObjectURL(blob);
      resultWrap.hidden = false;
      imageEl.src = resultUrl;
      imageEl.alt = 'Live microphone spectrogram';
      imageEl.hidden = false;
      downloadEl.href = resultUrl;
      downloadEl.download = `microphone-spectrogram-${new Date().toISOString().slice(0, 10)}.png`;
      downloadEl.hidden = false;
      renderNotes({
        outputs: [],
        stats: {
          frames: recordedColumns.length,
          'frequency range': `${Math.round(layout.minFreqHz)}–${Math.round(layout.maxFreqHz)} Hz`,
        },
        notes: ['This PNG was built live in your browser from the microphone capture.'],
      });
      announce('Exported your microphone spectrogram as a PNG.');
      recordedColumns = [];
      micExport.disabled = true;
    })();
  });

  // A "Capture" toggle is described by the astro; wire it here if present.
  const captureBtn = panel.querySelector<HTMLButtonElement>('[data-spec-capture]')!;
  if (captureBtn) {
    captureBtn.addEventListener('click', () => {
      if (!audioCtx || !analyser) {
        showError(errorBox, 'Start the microphone first.', 'Press "Use microphone" to begin monitoring.');
        return;
      }
      recording = !recording;
      captureBtn.setAttribute('aria-pressed', String(recording));
      captureBtn.textContent = recording ? 'Recording…' : 'Capture';
      announce(recording ? 'Recording a spectrogram capture.' : 'Capture stored — press Export to save the PNG.');
    });
  }
}