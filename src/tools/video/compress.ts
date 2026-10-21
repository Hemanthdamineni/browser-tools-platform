/**
 * Pure helpers for the video compressor.
 *
 * Nothing in this module touches the DOM, a codec or the network: every export
 * is a plain computation over numbers and strings, so the presets, the bitrate
 * maths, the memory warnings and the output file name can all be unit-tested
 * in Node without a browser codec. The browser-only parts (demuxing, decoding,
 * encoding) live in `video-compress.tool.ts`.
 */

import { ToolError } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  Limits                                                                     */
/* -------------------------------------------------------------------------- */

/** Largest source file we are willing to demux and re-encode (2 GB). */
export const COMPRESS_MAX_SOURCE_BYTES = 2 * 1024 ** 3;
/** Largest file we are willing to produce (512 MB) — it is held in memory. */
export const COMPRESS_MAX_OUTPUT_BYTES = 512 * 1024 ** 2;
/** Above this the finished file is big enough to warn about (64 MB). */
export const COMPRESS_WARN_OUTPUT_BYTES = 64 * 1024 ** 2;
/** Longest clip we re-encode (1 hour). */
export const COMPRESS_MAX_DURATION_SECONDS = 3600;
/** Clips longer than this get a heads-up (10 minutes). */
export const COMPRESS_WARN_DURATION_SECONDS = 600;
/** Narrowest output width we allow. */
export const COMPRESS_MIN_WIDTH = 16;
/** Widest output width we allow (4K). */
export const COMPRESS_MAX_WIDTH = 3840;
/** Lowest / highest frame rate we encode. */
export const COMPRESS_MIN_FPS = 1;
export const COMPRESS_MAX_FPS = 60;
/** Frame rate assumed when the container does not report one. */
export const COMPRESS_DEFAULT_FPS = 30;
/** Floor and ceiling for the video bitrate (bits per second). */
export const COMPRESS_MIN_VIDEO_BITRATE = 64_000;
export const COMPRESS_MAX_VIDEO_BITRATE = 80_000_000;
/** Floor and ceiling for the audio bitrate (bits per second). */
export const COMPRESS_MIN_AUDIO_BITRATE = 32_000;
export const COMPRESS_MAX_AUDIO_BITRATE = 256_000;
/** Audio bitrate used when the source does not report one. */
export const COMPRESS_DEFAULT_AUDIO_BITRATE = 128_000;
/** Smallest target size the "specific size" preset accepts (megabytes). */
export const COMPRESS_MIN_TARGET_MB = 0.1;
/** Largest target size the "specific size" preset accepts (megabytes). */
export const COMPRESS_MAX_TARGET_MB = 2048;

/* -------------------------------------------------------------------------- */
/*  Containers                                                                 */
/* -------------------------------------------------------------------------- */

export type CompressContainer = 'mp4' | 'webm';

/** File extension for each container we can write. */
export const CONTAINER_EXTENSIONS: Record<CompressContainer, string> = {
  mp4: 'mp4',
  webm: 'webm',
};

/** Human name for each container. */
export const CONTAINER_LABELS: Record<CompressContainer, string> = {
  mp4: 'MP4',
  webm: 'WebM',
};

/** MIME type for each container. */
export const CONTAINER_MIME_TYPES: Record<CompressContainer, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
};

/** Video codecs we prefer for each container, best first. */
export const CONTAINER_VIDEO_CODECS: Record<CompressContainer, readonly string[]> = {
  mp4: ['avc', 'hevc', 'av1', 'vp9'],
  webm: ['vp9', 'vp8', 'av1'],
};

/** Audio codecs we prefer for each container, best first. */
export const CONTAINER_AUDIO_CODECS: Record<CompressContainer, readonly string[]> = {
  mp4: ['aac', 'opus'],
  webm: ['opus', 'vorbis'],
};

/**
 * Read the container option. An unknown container is an error rather than a
 * silent fallback — writing the wrong container would produce a file that
 * does not play.
 */
export function resolveContainer(value: unknown): CompressContainer {
  const id = String(value ?? 'mp4').trim() || 'mp4';
  if (id === 'mp4' || id === 'webm') return id;
  throw new ToolError(
    `“${id}” is not a container this tool can write.`,
    'Choose MP4 (works everywhere) or WebM (VP9).',
  );
}

/* -------------------------------------------------------------------------- */
/*  Presets                                                                    */
/* -------------------------------------------------------------------------- */

export type CompressionPresetId =
  'size-50' | 'size-25' | 'size-target' | 'quality-high' | 'quality-medium' | 'quality-low';

export interface CompressionPreset {
  id: CompressionPresetId;
  /** Shown in the option picker. */
  label: string;
  /** One line explaining what the preset does. */
  description: string;
  /** Fraction of the source size this preset aims for (size presets only). */
  sizeFactor: number | null;
  /** Bits per pixel per frame used by the quality presets. */
  bitsPerPixel: number | null;
}

/**
 * The compression presets.
 *
 * The size presets aim at a concrete file size, which is what people usually
 * mean by "compress this video" (mail attachments, upload limits). The quality
 * presets aim at a picture quality instead and let the size fall where it may.
 */
export const COMPRESSION_PRESETS: readonly CompressionPreset[] = [
  {
    id: 'size-50',
    label: '50% smaller — half the size of the original',
    description: 'Halves the file size by lowering the video bitrate.',
    sizeFactor: 0.5,
    bitsPerPixel: null,
  },
  {
    id: 'size-25',
    label: '25% smaller — a quarter of the original size',
    description: 'A quarter of the original size. Visible quality loss on busy scenes.',
    sizeFactor: 0.25,
    bitsPerPixel: null,
  },
  {
    id: 'size-target',
    label: 'A specific target size',
    description: 'Encodes to the size you ask for, in megabytes.',
    sizeFactor: null,
    bitsPerPixel: null,
  },
  {
    id: 'quality-high',
    label: 'High quality — keep the picture, spend the bits',
    description: 'A generous bitrate for the resolution. Rarely smaller than the original.',
    sizeFactor: null,
    bitsPerPixel: 0.15,
  },
  {
    id: 'quality-medium',
    label: 'Medium quality — a good everyday balance',
    description: 'Roughly 60% of the high-quality bitrate. Barely visible difference.',
    sizeFactor: null,
    bitsPerPixel: 0.09,
  },
  {
    id: 'quality-low',
    label: 'Low quality — smallest possible file',
    description: 'A third of the high-quality bitrate. Best for sharing on slow links.',
    sizeFactor: null,
    bitsPerPixel: 0.05,
  },
];

/** Look up a preset, failing loudly on an unknown value. */
export function compressionPreset(value: unknown): CompressionPreset {
  const id = String(value ?? 'size-50').trim() || 'size-50';
  const preset = COMPRESSION_PRESETS.find((p) => p.id === id);
  if (!preset) {
    throw new ToolError(
      `“${id}” is not a known compression preset.`,
      `Choose one of: ${COMPRESSION_PRESETS.map((p) => p.id).join(', ')}.`,
    );
  }
  return preset;
}

/* -------------------------------------------------------------------------- */
/*  Source information                                                         */
/* -------------------------------------------------------------------------- */

/** What we know about the clip before we can plan the re-encode. */
export interface CompressSourceInfo {
  /** Size of the source file in bytes. */
  fileSize: number;
  /** Duration in seconds, or `null` when the container did not expose it. */
  durationSeconds: number | null;
  /** Display width of the video track (after rotation). */
  width: number;
  /** Display height of the video track (after rotation). */
  height: number;
  /** Frame rate of the source, when it could be measured. */
  frameRate: number | null;
  /** Average bitrate of the source video track, when it is known. */
  videoBitrate: number | null;
  /** Average bitrate of the source audio track, when it is known. */
  audioBitrate: number | null;
  /** Channel count of the source audio track, when it is known. */
  audioChannels: number | null;
  /** Sample rate of the source audio track, when it is known. */
  audioSampleRate: number | null;
  /** Whether the file carries an audio track. */
  hasAudio: boolean;
}

/** The concrete plan for the re-encode. */
export interface CompressSettings {
  /** The preset the plan was derived from. */
  presetId: CompressionPresetId;
  /** Container the result is written into. */
  container: CompressContainer;
  /** File extension of the result. */
  extension: string;
  /** Output width in pixels (always even). */
  width: number;
  /** Output height in pixels (always even). */
  height: number;
  /** Output frame rate, or `null` to keep the source frame rate. */
  frameRate: number | null;
  /** Whether the audio track is kept. */
  keepAudio: boolean;
  /** Audio bitrate in bits per second (0 when the audio is dropped). */
  audioBitrate: number;
  /** Video bitrate in bits per second. */
  videoBitrate: number;
  /** Video + audio bitrate in bits per second. */
  totalBitrate: number;
  /** The size the preset aims for, when it is a size preset. */
  targetBytes: number | null;
  /** Rough estimate of the produced file size, in bytes. */
  estimatedBytes: number;
  /** Whether the requested width was larger than the source and got clamped. */
  widthClamped: boolean;
  /** Things worth telling the user before/after the run. */
  warnings: string[];
}

/* -------------------------------------------------------------------------- */
/*  Option reading                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Read a numeric option.
 *
 * An empty value means "use the default" — the shared form submits an empty
 * string for a field the user cleared. Anything else that is not a number is an
 * error: silently falling back to the default would hand the user a file they
 * did not ask for.
 */
function readNumber(value: unknown, fallback: number, label: string): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') {
    throw new ToolError(`${label} must be a number.`, `Enter a number, not “${String(value)}”.`);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return fallback;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      throw new ToolError(`${label} must be a number.`, `“${trimmed}” is not a number.`);
    }
    return parsed;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ToolError(`${label} must be a number.`, 'Enter a number, such as 10.');
  }
  return value;
}

/* -------------------------------------------------------------------------- */
/*  Settings                                                                   */
/* -------------------------------------------------------------------------- */

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Round down to an even number — most encoders want even dimensions. */
function toEven(value: number): number {
  const rounded = Math.round(value);
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

/**
 * Turn the user's options into a concrete re-encode plan.
 *
 * Every failure is a `ToolError` with a human hint: an unknown preset, a
 * width of zero, a clip of unknown length and so on must never silently
 * produce a wrong file.
 */
export function resolveCompressSettings(
  options: Record<string, string | number | boolean | undefined>,
  source: CompressSourceInfo,
): CompressSettings {
  const preset = compressionPreset(options.preset);
  const container = resolveContainer(options.container);
  const warnings: string[] = [];

  /* --- the clip itself ------------------------------------------------- */

  if (!Number.isFinite(source.fileSize) || source.fileSize <= 0) {
    throw new ToolError('This file is empty (0 bytes).');
  }
  if (!Number.isFinite(source.width) || !Number.isFinite(source.height)) {
    throw new ToolError('This video reports invalid frame dimensions.');
  }
  if (source.width <= 0 || source.height <= 0) {
    throw new ToolError('This video reports invalid frame dimensions.');
  }

  const duration = source.durationSeconds;
  if (duration == null || !Number.isFinite(duration) || duration <= 0) {
    throw new ToolError(
      'The length of this clip could not be read, so the size cannot be calculated.',
      'Re-export the video — the file may be truncated.',
    );
  }
  if (duration > COMPRESS_MAX_DURATION_SECONDS) {
    throw new ToolError(
      `This clip is ${Math.round(duration / 60)} minutes long — longer than the ${COMPRESS_MAX_DURATION_SECONDS / 60} minute limit.`,
      'Trim the clip first, or split it into parts and compress them one by one.',
    );
  }
  if (duration > COMPRESS_WARN_DURATION_SECONDS) {
    warnings.push(
      `This clip is ${Math.round(duration / 60)} minutes long — the re-encode takes a while and the finished file is held in memory until you save it.`,
    );
  }

  /* --- output size ----------------------------------------------------- */

  const requestedWidth = readNumber(options.width, 0, 'The output width');
  if (requestedWidth < 0) {
    throw new ToolError('The output width must be 0 (keep the original) or more.');
  }
  if (requestedWidth > COMPRESS_MAX_WIDTH) {
    throw new ToolError(
      `The output width must be ${COMPRESS_MAX_WIDTH} pixels or less (you asked for ${requestedWidth}).`,
      'A narrower video is smaller and much faster to encode.',
    );
  }
  if (requestedWidth > 0 && requestedWidth < COMPRESS_MIN_WIDTH) {
    throw new ToolError(
      `The output width must be at least ${COMPRESS_MIN_WIDTH} pixels.`,
      'A very small frame looks like a postage stamp and compresses badly.',
    );
  }

  let width = requestedWidth > 0 ? requestedWidth : source.width;
  let widthClamped = false;
  if (width > source.width) {
    // Upscaling never makes a file smaller, so the source width wins.
    width = source.width;
    widthClamped = true;
    warnings.push(
      `The requested width was wider than the source (${source.width} px), so the original width was kept — enlarging a video never makes it smaller.`,
    );
  }
  width = toEven(width);
  if (width < COMPRESS_MIN_WIDTH) width = COMPRESS_MIN_WIDTH;
  const height = Math.max(2, toEven((source.height * width) / source.width));

  /* --- frame rate ------------------------------------------------------ */

  const requestedFps = readNumber(options.fps, 0, 'The maximum frame rate');
  if (requestedFps < 0) {
    throw new ToolError('The maximum frame rate must be 0 (keep the original) or more.');
  }
  if (requestedFps > COMPRESS_MAX_FPS) {
    throw new ToolError(
      `The maximum frame rate must be ${COMPRESS_MAX_FPS} fps or less (you asked for ${requestedFps}).`,
      'Pick 30 fps unless you really need more frames per second.',
    );
  }
  const sourceFps =
    source.frameRate != null && Number.isFinite(source.frameRate) && source.frameRate > 0
      ? source.frameRate
      : null;
  let frameRate: number | null;
  if (requestedFps > 0) {
    frameRate = clamp(requestedFps, COMPRESS_MIN_FPS, COMPRESS_MAX_FPS);
    if (sourceFps != null) frameRate = Math.min(frameRate, sourceFps);
  } else {
    frameRate = sourceFps ?? COMPRESS_DEFAULT_FPS;
  }
  frameRate = Math.round(frameRate * 1000) / 1000;

  /* --- audio ----------------------------------------------------------- */

  const wantsAudio = options.audio !== false;
  const keepAudio = wantsAudio && source.hasAudio;
  if (wantsAudio && !source.hasAudio) {
    warnings.push('This clip has no audio track, so there was nothing to keep.');
  }
  const audioBitrate = keepAudio
    ? clamp(
        source.audioBitrate != null && source.audioBitrate > 0
          ? source.audioBitrate
          : COMPRESS_DEFAULT_AUDIO_BITRATE,
        COMPRESS_MIN_AUDIO_BITRATE,
        COMPRESS_MAX_AUDIO_BITRATE,
      )
    : 0;

  /* --- bitrates -------------------------------------------------------- */

  const sourceTotalBitrate = (source.fileSize * 8) / duration;
  let targetBytes: number | null = null;
  let videoBitrate: number;

  if (preset.id === 'size-target') {
    const targetMb = readNumber(options.targetSize, 0, 'The target size');
    if (!Number.isFinite(targetMb) || targetMb <= 0) {
      throw new ToolError(
        'Enter the target size in megabytes.',
        `Pick a size between ${COMPRESS_MIN_TARGET_MB} MB and ${COMPRESS_MAX_TARGET_MB} MB.`,
      );
    }
    if (targetMb < COMPRESS_MIN_TARGET_MB) {
      throw new ToolError(
        `The target size must be at least ${COMPRESS_MIN_TARGET_MB} MB.`,
        'A file that small cannot hold a usable video.',
      );
    }
    if (targetMb > COMPRESS_MAX_TARGET_MB) {
      throw new ToolError(
        `The target size must be ${COMPRESS_MAX_TARGET_MB} MB or less (you asked for ${targetMb} MB).`,
      );
    }
    targetBytes = Math.round(targetMb * 1024 * 1024);
    if (targetBytes >= source.fileSize) {
      warnings.push(
        `The target size (${targetMb} MB) is bigger than the source file, so the original size was used as the ceiling — a re-encode never needs to make a file larger.`,
      );
      targetBytes = source.fileSize;
    }
    const targetTotalBitrate = (targetBytes * 8) / duration;
    videoBitrate = clamp(
      targetTotalBitrate - audioBitrate,
      COMPRESS_MIN_VIDEO_BITRATE,
      COMPRESS_MAX_VIDEO_BITRATE,
    );
  } else if (preset.sizeFactor != null) {
    targetBytes = Math.round(source.fileSize * preset.sizeFactor);
    const targetTotalBitrate = (targetBytes * 8) / duration;
    videoBitrate = clamp(
      targetTotalBitrate - audioBitrate,
      COMPRESS_MIN_VIDEO_BITRATE,
      COMPRESS_MAX_VIDEO_BITRATE,
    );
  } else {
    // Quality preset: derive the bitrate from the picture itself.
    const bpp = preset.bitsPerPixel ?? 0.09;
    const reference = width * height * (frameRate ?? COMPRESS_DEFAULT_FPS) * bpp;
    videoBitrate = clamp(reference, COMPRESS_MIN_VIDEO_BITRATE, COMPRESS_MAX_VIDEO_BITRATE);
    if (source.videoBitrate != null && source.videoBitrate > 0) {
      // Spending more bits than the source already uses only wastes space.
      videoBitrate = Math.min(videoBitrate, source.videoBitrate);
      videoBitrate = Math.max(videoBitrate, COMPRESS_MIN_VIDEO_BITRATE);
    }
  }

  const totalBitrate = videoBitrate + audioBitrate;
  const estimatedBytes = Math.round((totalBitrate * duration) / 8);

  if (estimatedBytes > COMPRESS_MAX_OUTPUT_BYTES) {
    throw new ToolError(
      `That would produce a file of roughly ${(estimatedBytes / 1024 / 1024).toFixed(0)} MB — over the ${COMPRESS_MAX_OUTPUT_BYTES / 1024 / 1024} MB limit.`,
      'Lower the frame rate, narrow the video, or pick a smaller target size.',
    );
  }
  if (estimatedBytes > COMPRESS_WARN_OUTPUT_BYTES) {
    warnings.push(
      `The compressed file is expected to be around ${(estimatedBytes / 1024 / 1024).toFixed(0)} MB. It is kept in memory until you download it, so close other tabs if the browser struggles.`,
    );
  }
  if (targetBytes != null && estimatedBytes > targetBytes * 1.05) {
    warnings.push(
      `Even at the lowest bitrate this tool allows, the clip comes out around ${(estimatedBytes / 1024 / 1024).toFixed(1)} MB — a little larger than the ${(targetBytes / 1024 / 1024).toFixed(1)} MB target.`,
    );
  }
  if (preset.id !== 'size-target' && preset.sizeFactor == null && sourceTotalBitrate > 0) {
    const sourceVideo = source.videoBitrate ?? sourceTotalBitrate;
    if (videoBitrate >= sourceVideo && sourceVideo > 0) {
      warnings.push(
        'The original is already compressed harder than this preset asks for, so the result may not be any smaller.',
      );
    }
  }

  return {
    presetId: preset.id,
    container,
    extension: CONTAINER_EXTENSIONS[container],
    width,
    height,
    frameRate,
    keepAudio,
    audioBitrate,
    videoBitrate,
    totalBitrate,
    targetBytes,
    estimatedBytes,
    widthClamped,
    warnings,
  };
}

/* -------------------------------------------------------------------------- */
/*  Reporting                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * How much smaller (or bigger) the result is, in words.
 * `42% smaller`, `3% larger` or `the same size`.
 */
export function formatSizeChange(sourceBytes: number, outputBytes: number): string {
  if (!Number.isFinite(sourceBytes) || sourceBytes <= 0) return 'an unknown size';
  if (!Number.isFinite(outputBytes) || outputBytes < 0) return 'an unknown size';
  const delta = (outputBytes - sourceBytes) / sourceBytes;
  const percent = Math.round(Math.abs(delta) * 100);
  if (percent === 0) return 'the same size';
  return delta < 0 ? `${percent}% smaller` : `${percent}% larger`;
}

/** The signed change in size, as a percentage (negative = smaller). */
export function sizeChangePercent(sourceBytes: number, outputBytes: number): number {
  if (!Number.isFinite(sourceBytes) || sourceBytes <= 0) return 0;
  if (!Number.isFinite(outputBytes)) return 0;
  return Math.round(((outputBytes - sourceBytes) / sourceBytes) * 1000) / 10;
}

/**
 * `holiday clip.mp4` → `holiday clip-compressed.mp4`.
 * Unicode is preserved and path separators are neutralised.
 */
export function compressOutputFilename(sourceName: string, extension: string): string {
  const cleaned = String(sourceName ?? '').replace(/[\\/]/g, '_');
  const base = cleaned.replace(/\.[^.]*$/, '').trim();
  const ext = String(extension ?? 'mp4').replace(/^\./, '') || 'mp4';
  return `${base || 'video'}-compressed.${ext}`;
}
