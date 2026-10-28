import { ToolError } from '@/lib/types';
import { decodeFile } from './lib';

export interface SpectrogramOptions {
  fftSize: number;
  windowType: 'hann' | 'hamming' | 'blackman' | 'rectangular';
  overlap: number; // 0-1
  colorMap: 'viridis' | 'inferno' | 'plasma' | 'magma' | 'jet' | 'grayscale';
  minDb: number;
  maxDb: number;
  freqMin: number;
  freqMax: number;
  logScale: boolean;
}

export interface SpectrogramData {
  /** Magnitude spectrogram: [frame][frequency bin] in dB */
  magnitudeDb: number[][];
  /** Frequencies for each bin (Hz) */
  frequencies: number[];
  /** Time for each frame (seconds) */
  times: number[];
  sampleRate: number;
  fftSize: number;
  hopSize: number;
}

/** Window functions */
export function getWindow(type: SpectrogramOptions['windowType'], size: number): Float32Array {
  const window = new Float32Array(size);
  switch (type) {
    case 'hann':
      for (let i = 0; i < size; i++) {
        window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
      }
      break;
    case 'hamming':
      for (let i = 0; i < size; i++) {
        window[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (size - 1));
      }
      break;
    case 'blackman':
      for (let i = 0; i < size; i++) {
        const a0 = 0.42, a1 = 0.5, a2 = 0.08;
        window[i] = a0 - a1 * Math.cos((2 * Math.PI * i) / (size - 1))
          + a2 * Math.cos((4 * Math.PI * i) / (size - 1));
      }
      break;
    case 'rectangular':
      window.fill(1);
      break;
  }
  return window;
}

/** Simple real FFT using Cooley-Tukey (for browser without Web Audio FFT) */
export function rfft(input: Float32Array): { real: Float32Array; imag: Float32Array } {
  const n = input.length;
  const real = new Float32Array(n / 2 + 1);
  const imag = new Float32Array(n / 2 + 1);

  // Use built-in DFT for simplicity (not optimized but works)
  for (let k = 0; k <= n / 2; k++) {
    let re = 0, im = 0;
    for (let t = 0; t < n; t++) {
      const angle = -2 * Math.PI * k * t / n;
      re += input[t] * Math.cos(angle);
      im += input[t] * Math.sin(angle);
    }
    real[k] = re;
    imag[k] = im;
  }
  return { real, imag };
}

/** Compute magnitude spectrum from FFT result */
export function computeMagnitude(real: Float32Array, imag: Float32Array): Float32Array {
  const n = real.length;
  const mag = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    mag[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
  }
  return mag;
}

/** Convert magnitude to dB */
export function magnitudeToDb(magnitude: Float32Array, ref = 1.0): Float32Array {
  const db = new Float32Array(magnitude.length);
  for (let i = 0; i < magnitude.length; i++) {
    db[i] = magnitude[i] > 0 ? 20 * Math.log10(magnitude[i] / ref) : -Infinity;
  }
  return db;
}

/** Generate spectrogram from decoded audio */
export async function generateSpectrogram(
  channels: Float32Array[],
  sampleRate: number,
  options: SpectrogramOptions
): Promise<SpectrogramData> {
  // Mix down to mono
  const len = Math.max(...channels.map(c => c.length));
  const mono = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    let sum = 0;
    for (const ch of channels) sum += ch[i] ?? 0;
    mono[i] = sum / channels.length;
  }

  const fftSize = options.fftSize;
  const hopSize = Math.floor(fftSize * (1 - options.overlap));
  const window = getWindow(options.windowType, fftSize);

  // Number of frames
  const numFrames = Math.floor((len - fftSize) / hopSize) + 1;
  if (numFrames <= 0) {
    throw new ToolError('Audio too short for selected FFT size.');
  }

  const magnitudeDb: number[][] = [];
  const times: number[] = [];
  const frequencies: number[] = [];

  // Pre-compute frequencies for each bin
  for (let k = 0; k <= fftSize / 2; k++) {
    frequencies.push((k * sampleRate) / fftSize);
  }

  // Filter frequency range
  const freqMin = options.freqMin;
  const freqMax = Math.min(options.freqMax, sampleRate / 2);
  const validBins = frequencies.map((f, i) => f >= freqMin && f <= freqMax ? i : -1).filter(i => i >= 0);
  const filteredFrequencies = validBins.map(i => frequencies[i]);

  for (let frame = 0; frame < numFrames; frame++) {
    const offset = frame * hopSize;
    const frameData = new Float32Array(fftSize);
    frameData.set(mono.subarray(offset, offset + fftSize));

    // Apply window
    for (let i = 0; i < fftSize; i++) {
      frameData[i] *= window[i];
    }

    // FFT
    const { real, imag } = rfft(frameData);
    const mag = computeMagnitude(real, imag);
    const db = magnitudeToDb(mag);

    // Filter to valid frequency range
    const frameDb = validBins.map(i => db[i]);
    magnitudeDb.push(frameDb);
    times.push((offset + fftSize / 2) / sampleRate);
  }

  return {
    magnitudeDb,
    frequencies: filteredFrequencies,
    times,
    sampleRate,
    fftSize,
    hopSize,
  };
}

/** Generate spectrogram from audio file */
export async function generateSpectrogramFromFile(
  file: File,
  options: SpectrogramOptions
): Promise<SpectrogramData> {
  const audio = await decodeFile(file);
  return generateSpectrogram(audio.channels, audio.sampleRate, options);
}

/** Color maps for spectrogram rendering */
export const COLOR_MAPS: Record<SpectrogramOptions['colorMap'], (t: number) => [number, number, number]> = {
  viridis: (t) => {
    // Viridis approximation
    t = Math.max(0, Math.min(1, t));
    const r = 0.23 + 0.58 * t + 0.24 * t * t;
    const g = 0.15 + 0.72 * t - 0.52 * t * t;
    const b = 0.57 - 0.77 * t + 0.32 * t * t;
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  },
  inferno: (t) => {
    t = Math.max(0, Math.min(1, t));
    const r = 0.002 + 1.8 * t - 1.2 * t * t + 0.4 * t * t * t;
    const g = 0.003 - 0.5 * t + 2.5 * t * t - 2.0 * t * t * t;
    const b = 0.54 + 0.6 * t - 1.5 * t * t + 1.1 * t * t * t;
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  },
  plasma: (t) => {
    t = Math.max(0, Math.min(1, t));
    const r = 0.05 + 1.5 * t - 1.2 * t * t + 0.5 * t * t * t;
    const g = 0.02 + 0.8 * t - 2.0 * t * t + 1.8 * t * t * t;
    const b = 0.45 + 0.5 * t - 1.5 * t * t + 1.2 * t * t * t;
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  },
  magma: (t) => {
    t = Math.max(0, Math.min(1, t));
    const r = 0.001 + 2.0 * t - 1.5 * t * t + 0.5 * t * t * t;
    const g = 0.002 + 0.5 * t - 1.8 * t * t + 1.5 * t * t * t;
    const b = 0.5 + 0.8 * t - 1.2 * t * t + 0.8 * t * t * t;
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  },
  jet: (t) => {
    t = Math.max(0, Math.min(1, t));
    let r, g, b;
    if (t < 0.125) { r = 0; g = 0; b = 0.5 + 4 * t; }
    else if (t < 0.375) { r = 0; g = 4 * (t - 0.125); b = 1; }
    else if (t < 0.625) { r = 4 * (t - 0.375); g = 1; b = 1 - 4 * (t - 0.375); }
    else if (t < 0.875) { r = 1; g = 1 - 4 * (t - 0.625); b = 0; }
    else { r = 1 - 4 * (t - 0.875); g = 0; b = 0; }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  },
  grayscale: (t) => {
    t = Math.max(0, Math.min(1, t));
    const v = Math.round(t * 255);
    return [v, v, v];
  },
};

/** Render spectrogram to canvas */
export function renderSpectrogramToCanvas(
  data: SpectrogramData,
  options: SpectrogramOptions,
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): void {
  const ctx = canvas.getContext('2d')!;
  canvas.width = width;
  canvas.height = height;

  const { magnitudeDb, frequencies, times } = data;
  const numFrames = times.length;
  const numBins = frequencies.length;

  if (numFrames === 0 || numBins === 0) return;

  const colorMap = COLOR_MAPS[options.colorMap];
  const minDb = options.minDb;
  const maxDb = options.maxDb;
  const dbRange = maxDb - minDb;

  // Create image data for efficient rendering
  const imgData = ctx.createImageData(numFrames, numBins);
  const pixels = imgData.data;

  for (let y = 0; y < numBins; y++) {
    for (let x = 0; x < numFrames; x++) {
      const db = magnitudeDb[x][y];
      let t = 0;
      if (Number.isFinite(db)) {
        t = Math.max(0, Math.min(1, (db - minDb) / dbRange));
      }
      const [r, g, b] = colorMap(t);
      const idx = (y * numFrames + x) * 4;
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = 255;
    }
  }

  // Draw scaled
  ctx.imageSmoothingEnabled = false;
  ctx.putImageData(imgData, 0, 0);
  ctx.scale(width / numFrames, height / numBins);

  // Draw axes and labels
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawAxes(ctx, width, height, data, options);
}

function drawAxes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: SpectrogramData,
  options: SpectrogramOptions
): void {
  const padding = { top: 30, right: 20, bottom: 50, left: 70 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  ctx.fillStyle = '#1e293b';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Title
  ctx.fillText('Spectrogram', width / 2, padding.top / 2);

  // Y-axis (frequency)
  ctx.save();
  ctx.translate(padding.left, padding.top + plotHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Frequency (Hz)', 0, -50);
  ctx.restore();

  // X-axis (time)
  ctx.fillText('Time (s)', width / 2, height - 10);

  // Y-axis ticks (log or linear)
  const freqTicks = options.logScale
    ? [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].filter(f => f >= options.freqMin && f <= options.freqMax)
    : generateLinearTicks(options.freqMin, options.freqMax, 6);

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const f of freqTicks) {
    let y: number;
    if (options.logScale) {
      const logMin = Math.log10(options.freqMin);
      const logMax = Math.log10(options.freqMax);
      const logF = Math.log10(f);
      y = padding.top + plotHeight * (1 - (logF - logMin) / (logMax - logMin));
    } else {
      y = padding.top + plotHeight * (1 - (f - options.freqMin) / (options.freqMax - options.freqMin));
    }
    y = Math.max(padding.top, Math.min(padding.top + plotHeight, y));
    ctx.fillText(f >= 1000 ? `${(f / 1000).toFixed(1)}k` : `${f}`, padding.left - 10, y);
    // Grid line
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + plotWidth, y);
    ctx.stroke();
  }

  // X-axis ticks
  const maxTime = data.times[data.times.length - 1] || 1;
  const timeTicks = generateLinearTicks(0, maxTime, 6);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const t of timeTicks) {
    const x = padding.left + plotWidth * (t / maxTime);
    ctx.fillText(t.toFixed(1), x, padding.top + plotHeight + 5);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, padding.top + plotHeight);
    ctx.stroke();
  }

  // Color bar
  drawColorBar(ctx, width, height, padding, options);
}

function generateLinearTicks(min: number, max: number, count: number): number[] {
  const ticks: number[] = [];
  const step = (max - min) / (count - 1);
  for (let i = 0; i < count; i++) {
    ticks.push(min + i * step);
  }
  return ticks;
}

function drawColorBar(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  padding: { top: number; right: number; bottom: number; left: number },
  options: SpectrogramOptions
): void {
  const barWidth = 20;
  const barHeight = height - padding.top - padding.bottom;
  const barX = width - padding.right - barWidth;
  const barY = padding.top;

  const colorMap = COLOR_MAPS[options.colorMap];
  const gradient = ctx.createLinearGradient(0, barY + barHeight, 0, barY);

  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    const [r, g, b] = colorMap(t);
    gradient.addColorStop(t, `rgb(${r},${g},${b})`);
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(barX, barY, barWidth, barHeight);
  ctx.strokeStyle = '#64748b';
  ctx.strokeRect(barX, barY, barWidth, barHeight);

  // Color bar labels
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${options.maxDb} dB`, barX + barWidth + 5, barY);
  ctx.textBaseline = 'middle';
  ctx.fillText(`${options.minDb} dB`, barX + barWidth + 5, barY + barHeight);
}

/** Export spectrogram as PNG */
export async function exportSpectrogramPng(
  data: SpectrogramData,
  options: SpectrogramOptions,
  width = 1200,
  height = 600
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  renderSpectrogramToCanvas(data, options, canvas, width, height);
  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}