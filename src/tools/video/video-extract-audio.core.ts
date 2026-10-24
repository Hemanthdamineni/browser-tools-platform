/**
 * Pure helpers for the audio extractor.
 *
 * Everything here is free of browser APIs: the format table, the option
 * resolution, the channel remix and the 16-bit PCM RIFF/WAVE writer. The tool
 * module (`./video-extract-audio.tool.ts`) drives the shared Mediabunny engine
 * and calls into these helpers, so the decision-making and the WAV bytes can
 * be unit-tested without a browser codec.
 *
 * WAV is written by this module itself — uncompressed PCM needs no encoder,
 * so it works in every browser that can decode the source. MP3 and AAC rely
 * on the browser's WebCodecs audio encoder; the tool checks availability and
 * says so in the UI when a format is not supported.
 */

import { ToolError } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  Limits                                                                     */
/* -------------------------------------------------------------------------- */

/** Largest source file we are willing to open (2 GB). */
export const EXTRACT_MAX_SOURCE_BYTES = 2 * 1024 ** 3;
/** Largest file we are willing to produce (512 MB) — it is held in memory. */
export const EXTRACT_MAX_OUTPUT_BYTES = 512 * 1024 ** 2;
/** Above this the finished file is big enough to warn about (64 MB). */
export const EXTRACT_WARN_OUTPUT_BYTES = 64 * 1024 ** 2;
/** Longest clip we extract from (1 hour). */
export const EXTRACT_MAX_DURATION_SECONDS = 3600;
/** Clips longer than this get a heads-up (10 minutes). */
export const EXTRACT_WARN_DURATION_SECONDS = 600;

/* -------------------------------------------------------------------------- */
/*  Formats                                                                    */
/* -------------------------------------------------------------------------- */

export type ExtractFormatId = 'wav' | 'mp3' | 'aac';

export interface ExtractFormatSpec {
  id: ExtractFormatId;
  /** Human name shown in notes and reports. */
  label: string;
  /** File extension without the dot. */
  extension: string;
  /** MIME type of the produced file. */
  mimeType: string;
  /** Whether the browser's audio encoder is required (false for WAV/PCM). */
  needsEncoder: boolean;
}

/** The output formats, in the order they are offered. */
export const EXTRACT_FORMATS: Record<ExtractFormatId, ExtractFormatSpec> = {
  wav: {
    id: 'wav',
    label: 'WAV (uncompressed PCM)',
    extension: 'wav',
    mimeType: 'audio/wav',
    needsEncoder: false,
  },
  mp3: {
    id: 'mp3',
    label: 'MP3',
    extension: 'mp3',
    mimeType: 'audio/mpeg',
    needsEncoder: true,
  },
  aac: {
    id: 'aac',
    label: 'AAC (ADTS)',
    extension: 'aac',
    mimeType: 'audio/aac',
    needsEncoder: true,
  },
};

/**
 * Read the format option. An unknown format is an error rather than a silent
 * fallback — writing the wrong format would produce a file that does not play.
 */
export function resolveAudioFormat(value: unknown): ExtractFormatId {
  const id = String(value ?? 'wav').trim() || 'wav';
  if (id === 'wav' || id === 'mp3' || id === 'aac') return id;
  throw new ToolError(
    `“${id}” is not a format this tool can write.`,
    'Choose WAV (lossless), MP3 (small, universal) or AAC (small, Apple-friendly).',
  );
}

/* -------------------------------------------------------------------------- */
/*  Channel mode + quality                                                     */
/* -------------------------------------------------------------------------- */

export type ChannelMode = 'original' | 'mono' | 'stereo';
export type QualityId = 'high' | 'medium' | 'low';

/** Bits per second for the compressed formats, per quality level. */
export const QUALITY_BITRATES: Record<QualityId, number> = {
  high: 192_000,
  medium: 128_000,
  low: 96_000,
};

/** Read the channel option. Unknown values fail loudly. */
export function resolveChannelMode(value: unknown): ChannelMode {
  const id = String(value ?? 'original').trim() || 'original';
  if (id === 'original' || id === 'mono' || id === 'stereo') return id;
  throw new ToolError(
    `“${id}” is not a channel layout this tool knows.`,
    'Choose original, mono or stereo.',
  );
}

/** Read the quality option (used by MP3 and AAC; WAV ignores it). */
export function resolveQuality(value: unknown): QualityId {
  const id = String(value ?? 'medium').trim() || 'medium';
  if (id === 'high' || id === 'medium' || id === 'low') return id;
  throw new ToolError(
    `“${id}” is not a known quality level.`,
    'Choose high, medium or low.',
  );
}

/* -------------------------------------------------------------------------- */
/*  Settings                                                                   */
/* -------------------------------------------------------------------------- */

/** What we know about the source before the work starts. */
export interface ExtractSourceInfo {
  /** Duration in seconds, or `null` when the container did not expose it. */
  durationSeconds: number | null;
  /** Channel count of the source audio track, when it is known. */
  channels: number | null;
  /** Sample rate of the source audio track in hertz. */
  sampleRate: number | null;
  /** Source audio codec id (`'aac'`, `'opus'`, …), when it is known. */
  codec: string | null;
  /** Size of the source file in bytes. */
  fileSize: number;
}

/** The concrete plan for the extraction. */
export interface ExtractSettings {
  formatId: ExtractFormatId;
  /** The format spec this plan was derived from. */
  format: ExtractFormatSpec;
  channelMode: ChannelMode;
  /**
   * Target channel count, or `null` to keep whatever the source has. `mono`
   * and `stereo` always resolve to 1 and 2; `original` resolves to the
   * source's channel count when it is known.
   */
  channelCount: number | null;
  /** Audio bitrate in bits per second (0 for WAV). */
  bitrate: number;
  /** Rough estimate of the produced file size in bytes, when computable. */
  estimatedBytes: number | null;
  /** Things worth telling the user before/after the run. */
  warnings: string[];
}

/**
 * Turn the user's options into a concrete extraction plan.
 *
 * Every failure is a `ToolError` with a human hint: an unknown format, an
 * absurd duration and so on must never silently produce a wrong file.
 */
export function resolveExtractSettings(
  options: Record<string, string | number | boolean | undefined>,
  source: ExtractSourceInfo,
): ExtractSettings {
  const formatId = resolveAudioFormat(options.format);
  const format = EXTRACT_FORMATS[formatId];
  const channelMode = resolveChannelMode(options.channels);
  const warnings: string[] = [];

  /* --- the clip itself -------------------------------------------------- */

  if (!Number.isFinite(source.fileSize) || source.fileSize <= 0) {
    throw new ToolError('This file is empty (0 bytes).');
  }
  if (
    source.durationSeconds != null &&
    (!Number.isFinite(source.durationSeconds) || source.durationSeconds < 0)
  ) {
    throw new ToolError('This file reports an invalid duration.');
  }
  if (source.durationSeconds != null && source.durationSeconds > EXTRACT_MAX_DURATION_SECONDS) {
    throw new ToolError(
      `This clip is ${Math.round(source.durationSeconds / 60)} minutes long — longer than the ${
        EXTRACT_MAX_DURATION_SECONDS / 60
      } minute limit.`,
      'Trim the clip first, or split it into parts and extract them one by one.',
    );
  }
  if (source.durationSeconds == null) {
    warnings.push(
      'The length of this file could not be read — the result may be larger than expected.',
    );
  } else if (source.durationSeconds > EXTRACT_WARN_DURATION_SECONDS) {
    warnings.push(
      `This clip is ${Math.round(source.durationSeconds / 60)} minutes long — the extraction takes a while and the finished file is held in memory until you save it.`,
    );
  }

  /* --- channels --------------------------------------------------------- */

  const channelCount =
    channelMode === 'mono'
      ? 1
      : channelMode === 'stereo'
        ? 2
        : source.channels != null && source.channels > 0
          ? source.channels
          : null;
  if (channelMode !== 'original' && (source.channels == null || source.channels <= 0)) {
    warnings.push(
      'The channel layout of the source could not be read; the layout is applied after decoding.',
    );
  }

  /* --- bitrate + size estimate ------------------------------------------ */

  const bitrate = format.needsEncoder ? QUALITY_BITRATES[resolveQuality(options.quality)] : 0;

  let estimatedBytes: number | null = null;
  if (source.durationSeconds != null && source.durationSeconds > 0) {
    if (formatId === 'wav') {
      const rate = source.sampleRate != null && source.sampleRate > 0 ? source.sampleRate : 48_000;
      const channels = channelCount ?? 2;
      estimatedBytes = estimateWavBytes(source.durationSeconds, rate, channels);
    } else {
      estimatedBytes = Math.round((bitrate * source.durationSeconds) / 8);
    }
  }
  if (estimatedBytes != null) {
    if (estimatedBytes > EXTRACT_MAX_OUTPUT_BYTES) {
      throw new ToolError(
        `That would produce a file of roughly ${(estimatedBytes / 1024 / 1024).toFixed(0)} MB — over the ${
          EXTRACT_MAX_OUTPUT_BYTES / 1024 / 1024
        } MB limit.`,
        'Pick MP3 or AAC instead of WAV, or extract a shorter clip.',
      );
    }
    if (estimatedBytes > EXTRACT_WARN_OUTPUT_BYTES) {
      warnings.push(
        `The extracted file is expected to be around ${(estimatedBytes / 1024 / 1024).toFixed(0)} MB. It is kept in memory until you download it, so close other tabs if the browser struggles.`,
      );
    }
  }

  return {
    formatId,
    format,
    channelMode,
    channelCount,
    bitrate,
    estimatedBytes,
    warnings,
  };
}

/* -------------------------------------------------------------------------- */
/*  Channels                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Remix decoded channels to `target` channels.
 *
 * Downmixing averages the channels in round-robin groups (so 5.1 → stereo
 * keeps a sensible left/right split); upmixing repeats the sources. Passing
 * the current count returns the input unchanged.
 */
export function remixChannels(channels: Float32Array[], target: number): Float32Array[] {
  if (!Number.isInteger(target) || target <= 0) {
    throw new Error('remixChannels: target must be a positive integer');
  }
  if (channels.length === 0) throw new Error('remixChannels: at least one channel is required');
  if (channels.length === target) return channels;

  const frames = Math.max(...channels.map((ch) => ch.length));
  const out: Float32Array[] = [];

  if (target < channels.length) {
    for (let t = 0; t < target; t++) {
      const mixed = new Float32Array(frames);
      let members = 0;
      let c = t;
      while (c < channels.length) {
        const ch = channels[c];
        if (ch) {
          for (let i = 0; i < frames; i++) mixed[i] = (mixed[i] ?? 0) + (ch[i] ?? 0);
          members += 1;
        }
        c += target;
      }
      if (members > 1) for (let i = 0; i < frames; i++) mixed[i] = (mixed[i] ?? 0) / members;
      out.push(mixed);
    }
    return out;
  }

  for (let t = 0; t < target; t++) {
    const ch = channels[t % channels.length];
    if (ch) out.push(ch.slice(0, frames));
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  WAV writer                                                                 */
/* -------------------------------------------------------------------------- */

/** Size of a canonical 16-bit PCM WAV file, header included. */
export function estimateWavBytes(
  durationSeconds: number,
  sampleRate: number,
  channelCount: number,
): number {
  const frames = Math.ceil(durationSeconds * sampleRate);
  return 44 + frames * channelCount * 2;
}

/** Convert float samples (-1..1) to interleaved 16-bit little-endian PCM. */
function interleave16(channels: Float32Array[], frames: number): Uint8Array {
  const numChannels = channels.length;
  const out = new Uint8Array(frames * numChannels * 2);
  const view = new DataView(out.buffer);
  let off = 0;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = channels[c]?.[i] ?? 0;
      const clamped = s < -1 ? -1 : s > 1 ? 1 : s;
      // Asymmetric scaling keeps 0 dBFS at ±full scale (−32768 … +32767).
      const v = Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff);
      view.setInt16(off, v, true);
      off += 2;
    }
  }
  return out;
}

/**
 * Encode float32 channels as a 16-bit PCM RIFF/WAVE file.
 *
 * Channels are interleaved; every channel must be the same length (shorter
 * channels are treated as zero-padded). The 44-byte canonical header carries
 * the sample rate and channel count verbatim — the rate is passed through
 * from the source, never resampled.
 */
export function encodeWavPcm16(channels: Float32Array[], sampleRate: number): Uint8Array {
  if (channels.length === 0) {
    throw new Error('encodeWavPcm16: at least one channel is required');
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error('encodeWavPcm16: sampleRate must be a positive finite number');
  }
  let frames = 0;
  for (const ch of channels) frames = Math.max(frames, ch.length);

  const numChannels = channels.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataBytes = frames * blockAlign;
  const fileBytes = 44 + dataBytes; // 44-byte canonical header

  const out = new Uint8Array(fileBytes);
  const view = new DataView(out.buffer);
  let o = 0;
  const ascii = (s: string) => {
    for (let i = 0; i < s.length; i++) out[o++] = s.charCodeAt(i);
  };
  const u32 = (v: number) => {
    view.setUint32(o, v, true);
    o += 4;
  };
  const u16 = (v: number) => {
    view.setUint16(o, v, true);
    o += 2;
  };

  ascii('RIFF');
  u32(fileBytes - 8);
  ascii('WAVE');
  ascii('fmt ');
  u32(16); // PCM fmt chunk size
  u16(1); // format: PCM
  u16(numChannels);
  u32(sampleRate);
  u32(sampleRate * blockAlign); // byte rate
  u16(blockAlign);
  u16(16); // bits per sample
  ascii('data');
  u32(dataBytes);

  out.set(interleave16(channels, frames), o);
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Reporting                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * `holiday clip.mp4` → `holiday clip-audio.wav`.
 * Unicode is preserved and path separators are neutralised.
 */
export function extractOutputFilename(sourceName: string, extension: string): string {
  const cleaned = String(sourceName ?? '').replace(/[\\/]/g, '_');
  const base = cleaned.replace(/\.[^.]*$/, '').trim();
  const ext = String(extension ?? 'wav').replace(/^\./, '') || 'wav';
  return `${base || 'video'}-audio.${ext}`;
}
