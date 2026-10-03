/**
 * Shared helpers for the E4-S5 audio file tools.
 *
 * Everything here is Web-Audio-based (decode, resample, channel maths) and must
 * run on the main thread because it needs `OfflineAudioContext`/`decodeAudioData`
 * (hence `meta.worker = false`). The final WAV bytes are produced by the
 * dependency-free `src/lib/audio.ts`.
 */

import { ToolError } from '@/lib/types';
import { encodeWavPCM16 } from '@/lib/audio';

/** Decoded audio + its original byte size / MIME. */
export interface DecodedAudio {
  /** De-interleaved channels, [sampleRate] Hz each. */
  channels: Float32Array[];
  sampleRate: number;
  /** Original file byte length. */
  byteSize: number;
  /** Original file MIME type if known. */
  mimeType: string;
}

/** A lightweight decode-context: OfflineAudioContext gives `decodeAudioData` with no speaker. */
function getDecodeContext(): typeof OfflineAudioContext {
  const ctor = globalThis.OfflineAudioContext;
  if (!ctor) throw new ToolError('Web Audio is not supported in this browser.');
  return ctor;
}

/**
 * Decode a file into plain Float32 channels, independent of the real-time
 * AudioContext (no audio hardware, no user-gesture requirement). Renders the
 * decoded buffer into a stereo-broadcast OfflineAudioContext so every channel
 * is preserved even in browsers whose decodeAudioData down-mixes to 2ch.
 */
export async function decodeFile(file: File): Promise<DecodedAudio> {
  const arrayBuffer = await file.arrayBuffer();
  const OfflineAudioContextCtor = getDecodeContext();

  let buffer: AudioBuffer;
  try {
    const probe = new OfflineAudioContextCtor(1, 1, 44100);
    buffer = await probe.decodeAudioData(arrayBuffer.slice(0));
  } catch {
    throw new ToolError('This browser could not decode that audio file.');
  }

  const { sampleRate, numberOfChannels, length } = buffer;
  if (numberOfChannels === 0 || length === 0) {
    throw new ToolError('This audio file contains no samples.');
  }

  // Broadcast the source into channels so we never silently drop any of them.
  const ctx = new OfflineAudioContextCtor(numberOfChannels, length, sampleRate);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
  const rendered = await ctx.startRendering();

  const channels: Float32Array[] = [];
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    channels.push(rendered.getChannelData(c).slice(0));
  }

  return {
    channels,
    sampleRate,
    byteSize: file.size,
    mimeType: file.type || '',
  };
}

/** Resample a single channel from `fromRate` to `toRate` by linear interpolation. */
export function resampleChannel(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input.slice(0);
  const ratio = toRate / fromRate;
  const outLength = Math.max(1, Math.round(input.length * ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const pos = i / ratio; // position in the source
    const i0 = Math.floor(pos);
    if (i0 >= input.length - 1) {
      out[i] = input[input.length - 1] ?? 0;
      continue;
    }
    const frac = pos - i0;
    out[i] = input[i0]! * (1 - frac) + input[i0 + 1]! * frac;
  }
  return out;
}

/** Down/up-mix channel layout: returns `count` channels. */
export function remixChannels(
  channels: Float32Array[],
  count: 1 | 2,
): Float32Array[] {
  if (count === 1) {
    // Average all source channels into one.
    const len = Math.max(...channels.map((c) => c.length));
    const mono = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      let sum = 0;
      for (const ch of channels) sum += ch[i] ?? 0;
      mono[i] = sum / channels.length;
    }
    return [mono];
  }
  // Stereo: keep existing stereo, else duplicate mono.
  if (channels.length === 2) return channels.map((c) => c.slice(0));
  if (channels.length === 1) return [channels[0]!.slice(0), channels[0]!.slice(0)];
  // >2 channels: fold into L/R (front-heavy average).
  const len = Math.max(...channels.map((c) => c.length));
  const left = new Float32Array(len);
  const right = new Float32Array(len);
  const leftCount = Math.ceil(channels.length / 2);
  for (let i = 0; i < len; i++) {
    let sl = 0;
    let sr = 0;
    channels.forEach((ch, idx) => {
      const v = ch[i] ?? 0;
      if (idx < leftCount) sl += v;
      else sr += v;
    });
    left[i] = sl / leftCount;
    right[i] = sr / (channels.length - leftCount);
  }
  return [left, right];
}

/** Clamp every sample of every channel to [-1, 1]. Returns whether hard clipping occurred. */
export function clampChannels(channels: Float32Array[]): boolean {
  let clipped = false;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const s = ch[i]!;
      if (s > 1) {
        ch[i] = 1;
        clipped = true;
      } else if (s < -1) {
        ch[i] = -1;
        clipped = true;
      }
    }
  }
  return clipped;
}

/** Common finaliser: encode channels to a WAV file Blob. */
export function toWavBlob(channels: Float32Array[], sampleRate: number): Blob {
  const bytes = encodeWavPCM16(channels, sampleRate);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type: 'audio/wav' });
}

/** Human-friendly "m:ss" (or "h:mm:ss") duration from seconds. */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/** Parse a time string ("SS", "M:SS", "H:MM:SS", or plain seconds) into seconds. */
export function parseTime(input: string): number {
  const s = String(input).trim();
  if (s === '') throw new ToolError('Enter a start time.');
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const parts = s.split(':');
  if (parts.length > 3) throw new ToolError(`Invalid time "${input}".`);
  if (!parts.every((p) => /^\d+(\.\d+)?$/.test(p))) {
    throw new ToolError(`Invalid time "${input}". Use SS, M:SS or H:MM:SS.`);
  }
  let secs = 0;
  for (const p of parts) {
    secs = secs * 60 + Number(p);
  }
  return secs;
}

/** dB (may be negative) to a linear gain factor. */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/** Convert a `Float32Array` value to a dBFS figure (negative dB; -Infinity for silence). */
export function amplitudeToDb(v: number): number {
  if (v <= 0) return -Infinity;
  return 20 * Math.log10(v);
}
