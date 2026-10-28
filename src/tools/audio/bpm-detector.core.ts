import { ToolError } from '@/lib/types';
import { decodeFile } from './lib';

export interface BpmDetectorOptions {
  minBpm: number;
  maxBpm: number;
  onsetThreshold: number;
}

export interface BpmResult {
  bpm: number;
  confidence: number;
  candidates: Array<{ bpm: number; confidence: number }>;
  onsetCount: number;
  durationSec: number;
}

/** Compute spectral flux onset detection */
export function computeOnsetEnvelope(
  channels: Float32Array[],
  sampleRate: number,
  options: { fftSize?: number; hopSize?: number } = {}
): { envelope: Float32Array; times: number[] } {
  const { fftSize = 1024, hopSize = 512 } = options;

  // Mix to mono
  const len = Math.max(...channels.map(c => c.length));
  const mono = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    let sum = 0;
    for (const ch of channels) sum += ch[i] ?? 0;
    mono[i] = sum / channels.length;
  }

  // Hann window
  const window = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
  }

  const numFrames = Math.floor((len - fftSize) / hopSize) + 1;
  if (numFrames <= 1) {
    throw new ToolError('Audio too short for onset detection.');
  }

  const envelope = new Float32Array(numFrames);
  const times = new Float32Array(numFrames);
  let prevMag: Float32Array | null = null;

  for (let frame = 0; frame < numFrames; frame++) {
    const offset = frame * hopSize;
    const frameData = new Float32Array(fftSize);
    frameData.set(mono.subarray(offset, offset + fftSize));

    // Apply window
    for (let i = 0; i < fftSize; i++) frameData[i] *= window[i]!;

    // Simple DFT for magnitude spectrum (only need first half)
    const mag = new Float32Array(fftSize / 2 + 1);
    for (let k = 0; k <= fftSize / 2; k++) {
      let re = 0, im = 0;
      for (let t = 0; t < fftSize; t++) {
        const angle = -2 * Math.PI * k * t / fftSize;
        re += frameData[t]! * Math.cos(angle);
        im += frameData[t]! * Math.sin(angle);
      }
      mag[k] = Math.sqrt(re * re + im * im);
    }

    // Spectral flux: sum of positive differences
    if (prevMag) {
      let flux = 0;
      for (let k = 0; k < mag.length; k++) {
        const diff = mag[k]! - prevMag[k]!;
        if (diff > 0) flux += diff;
      }
      envelope[frame] = flux;
    } else {
      envelope[frame] = 0;
    }

    prevMag = mag;
    times[frame] = (offset + fftSize / 2) / sampleRate;
  }

  // Normalize envelope
  let maxEnv = 0;
  for (let i = 0; i < envelope.length; i++) {
    if (envelope[i]! > maxEnv) maxEnv = envelope[i]!;
  }
  if (maxEnv > 0) {
    for (let i = 0; i < envelope.length; i++) {
      envelope[i]! /= maxEnv;
    }
  }

  return { envelope, times: Array.from(times) };
}

/** Pick peaks in onset envelope */
export function pickPeaks(
  envelope: Float32Array,
  threshold: number,
  minDistance: number
): number[] {
  const peaks: number[] = [];
  for (let i = 1; i < envelope.length - 1; i++) {
    if (envelope[i]! > envelope[i - 1]! && envelope[i]! > envelope[i + 1]! && envelope[i]! >= threshold) {
      // Check minimum distance from last peak
      if (peaks.length === 0 || i - peaks[peaks.length - 1]! >= minDistance) {
        peaks.push(i);
      }
    }
  }
  return peaks;
}

/** Autocorrelation of onset intervals */
export function autocorrelateIntervals(intervals: number[]): { period: number; confidence: number } {
  if (intervals.length < 2) return { period: 0, confidence: 0 };

  // Build histogram of intervals
  const maxInterval = Math.max(...intervals);
  const histSize = maxInterval + 1;
  const histogram = new Float32Array(histSize);

  for (const interval of intervals) {
    histogram[Math.round(interval)] += 1;
  }

  // Autocorrelation of histogram
  let bestLag = 0;
  let bestCorr = -1;

  for (let lag = 1; lag < histSize / 2; lag++) {
    let corr = 0, norm1 = 0, norm2 = 0;
    for (let i = 0; i < histSize - lag; i++) {
      corr += histogram[i]! * histogram[i + lag]!;
      norm1 += histogram[i]! * histogram[i]!;
      norm2 += histogram[i + lag]! * histogram[i + lag]!;
    }
    if (norm1 > 0 && norm2 > 0) {
      corr /= Math.sqrt(norm1 * norm2);
      if (corr > bestCorr) {
        bestCorr = corr;
        bestLag = lag;
      }
    }
  }

  return { period: bestLag, confidence: bestCorr };
}

/** Main BPM detection */
export async function detectBpm(
  file: File,
  options: BpmDetectorOptions
): Promise<BpmResult> {
  const audio = await decodeFile(file);
  const sampleRate = audio.sampleRate;

  // Compute onset envelope
  const { envelope, times } = computeOnsetEnvelope(audio.channels, sampleRate);

  // Convert min/max BPM to min/max period in frames
  const hopSize = 512;
  const framesPerSecond = sampleRate / hopSize;
  const minPeriodFrames = Math.round(60 / options.maxBpm * framesPerSecond);
  const maxPeriodFrames = Math.round(60 / options.minBpm * framesPerSecond);

  // Pick peaks
  const minPeakDistance = Math.max(1, minPeriodFrames / 2);
  const peaks = pickPeaks(envelope, options.onsetThreshold, minPeakDistance);

  if (peaks.length < 3) {
    throw new ToolError('Not enough onsets detected. Try lowering the onset threshold or use audio with a clearer beat.');
  }

  // Compute intervals between peaks (in frames)
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }

  // Autocorrelation to find dominant period
  const { period: dominantPeriodFrames, confidence } = autocorrelateIntervals(intervals);

  if (dominantPeriodFrames === 0) {
    throw new ToolError('Could not determine a stable tempo.');
  }

  // Convert to BPM
  const bpm = 60 * framesPerSecond / dominantPeriodFrames;

  // Find candidate tempos (harmonics/subharmonics)
  const candidates: Array<{ bpm: number; confidence: number }> = [];

  // Primary candidate
  if (bpm >= options.minBpm && bpm <= options.maxBpm) {
    candidates.push({ bpm: Math.round(bpm * 10) / 10, confidence });
  }

  // Double tempo (if in range)
  const doubleBpm = bpm * 2;
  if (doubleBpm <= options.maxBpm) {
    const dbpm = Math.round(doubleBpm * 10) / 10;
    candidates.push({ bpm: dbpm, confidence: confidence * 0.7 });
  }

  // Half tempo (if in range)
  const halfBpm = bpm / 2;
  if (halfBpm >= options.minBpm) {
    const hbpm = Math.round(halfBpm * 10) / 10;
    candidates.push({ bpm: hbpm, confidence: confidence * 0.6 });
  }

  // Sort by confidence
  candidates.sort((a, b) => b.confidence - a.confidence);

  // Round primary BPM
  const finalBpm = Math.round(candidates[0]?.bpm || bpm);

  return {
    bpm: finalBpm,
    confidence: candidates[0]?.confidence || confidence,
    candidates: candidates.slice(0, 5),
    onsetCount: peaks.length,
    durationSec: times[times.length - 1] || 0,
  };
}