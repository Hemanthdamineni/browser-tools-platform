/**
 * Pure, dependency-light logic for the audio-convert tool.
 *
 * Everything here is testable without a browser: format selection, WAV header
 * bytes (reusing `encodeWavPCM16`), MP3 frame-size bookkeeping, the Opus
 * feature-detect, and output filename/extension mapping. Real encoding lives
 * in `audio-convert.tool.ts` (which lazily loads the MP3 encoder chunk); it is
 * deliberately not exercised in tests.
 */

import { ToolError } from '@/lib/types';
import { encodeWavPCM16 } from '@/lib/audio';

export type ConvertFormat = 'wav' | 'mp3' | 'opus';

/** The output formats, in the order they appear in the UI select. */
export const FORMATS: readonly ConvertFormat[] = ['wav', 'mp3', 'opus'];

/** File extension for each output format. */
export const FORMAT_EXT: Record<ConvertFormat, string> = {
  wav: 'wav',
  mp3: 'mp3',
  opus: 'opus',
};

/** MIME type used for each output Blob. */
export const FORMAT_MIME: Record<ConvertFormat, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  opus: 'audio/ogg',
};

/** Validate the requested output format and return the canonical key. */
export function resolveFormat(value: unknown): ConvertFormat {
  const format = String(value ?? 'wav').toLowerCase();
  if (!(FORMATS as readonly string[]).includes(format)) {
    throw new ToolError(
      `“${format}” is not a supported output format.`,
      'Choose WAV, MP3 or Opus/OGG.',
    );
  }
  return format as ConvertFormat;
}

/** File extension for the chosen format (`.wav`, `.mp3`, `.opus`). */
export function outputExtension(format: ConvertFormat): string {
  return FORMAT_EXT[format];
}

/** MIME type for the chosen format. */
export function outputMime(format: ConvertFormat): string {
  return FORMAT_MIME[format];
}

/**
 * Output filename for one input: same base name, new extension. `audio` is the
 * fallback stem for inputs with no base name (e.g. `tone.input`).
 */
export function outputFilename(name: string, format: ConvertFormat): string {
  return `${name.replace(/\.[^.]*$/, '') || 'audio'}.${outputExtension(format)}`;
}

/**
 * WAV encoding — the header and sample bytes are produced by the shared
 * `encodeWavPCM16` writer (canonical 44-byte RIFF/WAVE header, 16-bit PCM,
 * little-endian). Kept behind a named function so the header contract is
 * reused byte-for-byte by the tests and the tool alike.
 */
export function encodeWav(channels: Float32Array[], sampleRate: number): Uint8Array {
  return encodeWavPCM16(channels, sampleRate);
}

/** Samples consumed by a single MP3 frame in a LAME/MPEG-1 encoder. */
export const MP3_SAMPLES_PER_FRAME = 1152;

/** Number of MP3 frames needed to hold `samples` input samples. */
export function mp3FrameCount(samples: number, perFrame = MP3_SAMPLES_PER_FRAME): number {
  return Math.max(0, Math.ceil(samples / perFrame));
}

/**
 * Bookkeeping for MP3 output: each `encodeBuffer`/`flush` call returns a
 * variable-size frame chunk, so we track cumulative encoded bytes and how far
 * through the expected frame count we are. This lets `run()` report progress
 * and a final byte count without re-scanning every chunk.
 */
export class Mp3ByteCounter {
  /** Number of MP3 frames the whole stream is expected to contain. */
  readonly expectedFrames: number;
  private bytes = 0, frames = 0;

  constructor(totalSamples: number, perFrame = MP3_SAMPLES_PER_FRAME) {
    this.expectedFrames = mp3FrameCount(totalSamples, perFrame);
  }

  /** Cumulative encoded bytes. */
  get size(): number {
    return this.bytes;
  }

  /** Count of frame chunks appended so far. */
  get count(): number {
    return this.frames;
  }

  /** Progress through the expected frames as a 0..1 fraction. */
  get progress(): number {
    return this.expectedFrames === 0 ? 1 : Math.min(1, this.frames / this.expectedFrames);
  }

  /** Record one encoded chunk; returns the running total of bytes. */
  add(chunk: Uint8Array): number {
    this.bytes += chunk.length;
    this.frames += 1;
    return this.bytes;
  }
}

/** The subset of `globalThis` the Opus feature-detect inspects. */
export interface WebCodecsEnv {
  AudioEncoder?: unknown;
}

/**
 * Whether the browser's WebCodecs `AudioEncoder` (Chrome 94+) is available.
 * Opus export depends on it; without it the tool says Opus is unsupported
 * instead of shipping a broken encoding path. The env argument keeps the
 * detect pure and unit-testable.
 */
export function opusSupported(env: WebCodecsEnv = globalThis as WebCodecsEnv): boolean {
  return typeof env.AudioEncoder === 'function';
}

/** Resolve the requested sample rate to a concrete number. */
export function resolveSampleRate(value: unknown, original: number): number {
  if (String(value ?? 'original') === 'original') return original;
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 1) {
    throw new ToolError('Choose a valid sample rate.');
  }
  return rate;
}

/** Resolve the channel option to a remix target (1 = mono, 2 = stereo, null = keep). */
export function resolveChannelMode(value: unknown): 1 | 2 | null {
  const mode = String(value ?? 'original');
  if (mode === 'mono') return 1;
  if (mode === 'stereo') return 2;
  return null;
}

/** Clamp and return the MP3/Opus bitrate in kbps. */
export function resolveBitrate(value: unknown): number {
  const kbps = Number(value ?? 128);
  if (!Number.isFinite(kbps)) return 128;
  return Math.round(Math.min(320, Math.max(32, kbps)));
}