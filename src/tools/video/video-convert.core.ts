/**
 * Pure helpers for the video converter.
 *
 * Everything here is free of browser APIs: given a description of the source
 * file and the user's choices, it decides *how* the file is converted —
 * remuxed with a stream copy when the codecs fit the target container, or
 * re-encoded when they do not — and what the result should be called.
 * `video-convert.tool.ts` turns that plan into real bytes.
 */

import { ToolError } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/*  Limits                                                                     */
/* -------------------------------------------------------------------------- */

/** Largest source file we are willing to open (2 GB — the shared probe ceiling). */
export const CONVERT_MAX_SOURCE_BYTES = 2 * 1024 ** 3;
/**
 * Largest file we are willing to produce (512 MB): the result is muxed into
 * memory before the user downloads it, exactly like the compressor's output.
 */
export const CONVERT_MAX_OUTPUT_BYTES = 512 * 1024 ** 2;
/** Above this the finished file is big enough to warn about (64 MB). */
export const CONVERT_WARN_OUTPUT_BYTES = 64 * 1024 ** 2;
/** Floor and ceiling for the video bitrate used when re-encoding (bits per second). */
export const CONVERT_MIN_VIDEO_BITRATE = 256_000;
export const CONVERT_MAX_VIDEO_BITRATE = 80_000_000;
/** Video bitrate assumed when the source does not report one. */
export const CONVERT_DEFAULT_VIDEO_BITRATE = 4_000_000;
/** Audio bitrate assumed for a re-encoded sound track. */
export const CONVERT_DEFAULT_AUDIO_BITRATE = 128_000;

/* -------------------------------------------------------------------------- */
/*  Containers                                                                 */
/* -------------------------------------------------------------------------- */

export type ConvertContainer = 'mp4' | 'webm' | 'mov' | 'mkv';

export interface ConvertContainerSpec {
  /** Human name, e.g. `MP4`. */
  label: string;
  /** File extension without the dot. */
  extension: string;
  /** MIME type of the produced file. */
  mimeType: string;
  /**
   * Every video codec this container can hold, per the shared engine. Used to
   * validate an explicitly requested codec.
   */
  videoCodecs: readonly string[];
  /**
   * Video codecs that are safe to *stream-copy* into this container — i.e.
   * the combinations that play reliably in ordinary players. A source codec
   * in this set is remuxed; anything else is re-encoded.
   *
   * The engine can technically store VP9, AV1 and VP8 inside MP4/MOV too, but
   * player support for those combinations is thin, so the tool re-encodes
   * instead of producing a file half the world cannot play.
   */
  remuxVideoCodecs: readonly string[];
  /** Audio codecs that are safe to stream-copy into this container. */
  remuxAudioCodecs: readonly string[];
  /** Video codecs to try when re-encoding, best first. */
  videoEncodePreference: readonly string[];
  /** Audio codecs to try when re-encoding, best first. */
  audioEncodePreference: readonly string[];
}

export const CONTAINERS: Record<ConvertContainer, ConvertContainerSpec> = {
  mp4: {
    label: 'MP4',
    extension: 'mp4',
    mimeType: 'video/mp4',
    videoCodecs: ['avc', 'hevc', 'vp9', 'av1', 'vp8', 'prores'],
    remuxVideoCodecs: ['avc', 'hevc'],
    remuxAudioCodecs: ['aac', 'mp3'],
    videoEncodePreference: ['avc', 'hevc', 'av1', 'vp9'],
    audioEncodePreference: ['aac', 'opus'],
  },
  webm: {
    label: 'WebM',
    extension: 'webm',
    mimeType: 'video/webm',
    videoCodecs: ['vp9', 'av1', 'vp8'],
    remuxVideoCodecs: ['vp9', 'vp8', 'av1'],
    remuxAudioCodecs: ['opus', 'vorbis'],
    videoEncodePreference: ['vp9', 'vp8', 'av1'],
    audioEncodePreference: ['opus', 'vorbis'],
  },
  mov: {
    label: 'QuickTime (MOV)',
    extension: 'mov',
    mimeType: 'video/quicktime',
    videoCodecs: ['avc', 'hevc', 'vp9', 'av1', 'vp8', 'prores'],
    remuxVideoCodecs: ['avc', 'hevc', 'prores'],
    remuxAudioCodecs: ['aac', 'mp3', 'pcm-s16', 'pcm-s24', 'pcm-s32', 'pcm-f32'],
    videoEncodePreference: ['avc', 'hevc', 'av1', 'vp9'],
    audioEncodePreference: ['aac', 'opus'],
  },
  mkv: {
    label: 'Matroska (MKV)',
    extension: 'mkv',
    mimeType: 'video/x-matroska',
    videoCodecs: ['avc', 'hevc', 'vp9', 'av1', 'vp8', 'prores'],
    remuxVideoCodecs: ['avc', 'hevc', 'vp9', 'vp8', 'av1', 'prores'],
    remuxAudioCodecs: [
      'aac',
      'opus',
      'mp3',
      'vorbis',
      'flac',
      'ac3',
      'eac3',
      'dts',
      'pcm-s16',
      'pcm-s24',
      'pcm-s32',
      'pcm-f32',
    ],
    videoEncodePreference: ['vp9', 'av1', 'avc', 'hevc'],
    audioEncodePreference: ['opus', 'aac'],
  },
};

/** The containers the container option accepts, in picker order. */
export const CONVERT_CONTAINER_IDS: readonly ConvertContainer[] = ['mp4', 'webm', 'mov', 'mkv'];

/** Read the container option. An unknown container is an error, never a guess. */
export function resolveContainer(value: unknown): ConvertContainer {
  const id = String(value ?? 'mp4').trim() || 'mp4';
  if (id in CONTAINERS) return id as ConvertContainer;
  throw new ToolError(
    `“${id}” is not a container this tool can write.`,
    `Choose one of: ${CONVERT_CONTAINER_IDS.join(', ')}.`,
  );
}

/* -------------------------------------------------------------------------- */
/*  Option reading                                                             */
/* -------------------------------------------------------------------------- */

/** User-facing names for the codecs the video-codec option can request. */
const VIDEO_CODEC_CHOICES: Record<string, string> = {
  auto: 'auto',
  h264: 'avc',
  h265: 'hevc',
  vp8: 'vp8',
  vp9: 'vp9',
  av1: 'av1',
};

/** The option values the video-codec picker offers, in order. */
export const CONVERT_VIDEO_CODEC_CHOICES: readonly string[] = Object.keys(VIDEO_CODEC_CHOICES);

/** The concrete plan the user's options describe. */
export interface ConvertPreferences {
  container: ConvertContainer;
  /** `auto` lets the tool pick; otherwise a codec id such as `avc`. */
  videoCodec: 'auto' | string;
  keepAudio: boolean;
}

/**
 * Turn the raw form values into a concrete preference set.
 *
 * Every failure is a `ToolError` with a human hint: an unknown container or
 * codec must never silently produce a file the user did not ask for.
 */
export function resolveConvertOptions(
  options: Record<string, string | number | boolean | undefined>,
): ConvertPreferences {
  const container = resolveContainer(options.container);

  const rawCodec = String(options.videoCodec ?? 'auto').trim() || 'auto';
  const videoCodec = VIDEO_CODEC_CHOICES[rawCodec];
  if (!videoCodec) {
    throw new ToolError(
      `“${rawCodec}” is not a video codec this tool can target.`,
      `Choose one of: ${CONVERT_VIDEO_CODEC_CHOICES.join(', ')}.`,
    );
  }

  const keepAudio = options.audio !== false && options.audio !== 'false';

  return { container, videoCodec, keepAudio };
}

/* -------------------------------------------------------------------------- */
/*  Source description                                                         */
/* -------------------------------------------------------------------------- */

/** What the tool knows about the clip before it decides how to convert it. */
export interface ConvertSource {
  /** Size of the source file in bytes. */
  fileSize: number;
  /** Human container name of the source, e.g. `MP4` or `Matroska`. */
  formatName: string;
  /** Duration in seconds, or `null` when the container did not expose it. */
  durationSeconds: number | null;
  /** Display width of the video track. */
  width: number;
  /** Display height of the video track. */
  height: number;
  /** Frame rate of the source, when it could be measured. */
  frameRate: number | null;
  /** Codec id of the video track, e.g. `avc` — `null` when unknown. */
  videoCodec: string | null;
  /** Human-readable video codec, for messages. */
  videoCodecLabel: string;
  /** Whether this browser can decode the video track (a prerequisite for re-encoding). */
  videoDecodable: boolean;
  /** Average bitrate of the source video track, when it is known. */
  videoBitrate: number | null;
  /** Whether the file carries an audio track. */
  hasAudio: boolean;
  /** Codec id of the audio track, e.g. `aac` — `null` when unknown. */
  audioCodec: string | null;
  /** Whether this browser can decode the audio track. */
  audioDecodable: boolean;
  /** Channel count of the audio track, when it is known. */
  audioChannels: number | null;
  /** Sample rate of the audio track, when it is known. */
  audioSampleRate: number | null;
}

/* -------------------------------------------------------------------------- */
/*  The conversion plan                                                        */
/* -------------------------------------------------------------------------- */

export type ConvertPath = 'remux' | 'transcode';

export interface ConvertTrackPlan {
  /** `remux` copies the encoded stream; `transcode` decodes and re-encodes it. */
  path: ConvertPath | 'drop';
  /** The codec involved: the copied one, the new one, or `null`. */
  codec: string | null;
}

/** The concrete plan for the conversion. */
export interface ConvertPlan {
  container: ConvertContainer;
  /** File extension of the result. */
  extension: string;
  video: ConvertTrackPlan;
  audio: ConvertTrackPlan;
  /** Video bitrate to encode with, when the video is re-encoded. */
  bitrate: number | null;
  /** Things worth telling the user up front. */
  warnings: string[];
}

/** What the browser can do, as far as the plan is concerned. */
export interface ConvertCapabilities {
  /** Whether WebCodecs is available at all. */
  webCodecs: boolean;
  /** Video codecs this browser can encode. */
  encodableVideo: readonly string[];
  /** Audio codecs this browser can encode. */
  encodableAudio: readonly string[];
}

/**
 * Decide how the file is converted.
 *
 * The rule is: stream-copy (remux) whatever the target container holds
 * reliably, re-encode what it does not, and fail loudly when neither is
 * possible. A silent wrong output — a file whose video codec does not match
 * the container, or a missing picture — is never an option.
 */
export function decideConvertPlan(
  source: ConvertSource,
  prefs: ConvertPreferences,
  capabilities: ConvertCapabilities,
): ConvertPlan {
  const spec = CONTAINERS[prefs.container];
  const warnings: string[] = [];

  /* --- video ------------------------------------------------------------ */

  let video: ConvertTrackPlan;
  if (prefs.videoCodec !== 'auto') {
    // An explicit codec is a promise: the output carries exactly that codec.
    if (!spec.videoCodecs.includes(prefs.videoCodec)) {
      throw new ToolError(
        `${labelForVideoCodec(prefs.videoCodec)} cannot be stored in ${spec.label}.`,
        'Pick “Auto” and let the tool choose, or choose a container that holds that codec.',
      );
    }
    if (!capabilities.encodableVideo.includes(prefs.videoCodec)) {
      throw new ToolError(
        `This browser cannot encode ${labelForVideoCodec(prefs.videoCodec)}.`,
        'Pick “Auto” to use any codec the browser can produce, or try another browser.',
      );
    }
    video = { path: 'transcode', codec: prefs.videoCodec };
  } else if (source.videoCodec && spec.remuxVideoCodecs.includes(source.videoCodec)) {
    // The codec already fits: copy the encoded stream, no quality lost.
    video = { path: 'remux', codec: source.videoCodec };
  } else if (!source.videoDecodable) {
    // Re-encoding needs a decoded picture; without one there is nothing to do.
    const held = source.videoCodec
      ? `${source.videoCodecLabel} is not stored reliably in ${spec.label}`
      : 'The video codec of this file is unknown';
    throw new ToolError(
      `${held}, and this browser cannot decode it for re-encoding.`,
      `Convert to ${spec.label} from an H.264 or VP9 source, or pick MKV — Matroska holds almost every codec.`,
    );
  } else {
    const codec =
      spec.videoEncodePreference.find((candidate) =>
        capabilities.encodableVideo.includes(candidate),
      ) ?? null;
    if (!codec) {
      throw new ToolError(
        `This browser cannot encode any video format ${spec.label} needs.`,
        'Try a recent Chrome, Edge or Firefox — the tool needs WebCodecs to re-encode the video.',
      );
    }
    video = { path: 'transcode', codec };
  }

  /* --- audio ------------------------------------------------------------ */

  let audio: ConvertTrackPlan;
  if (!source.hasAudio) {
    audio = { path: 'drop', codec: null };
  } else if (!prefs.keepAudio) {
    audio = { path: 'drop', codec: null };
    warnings.push('The audio track was dropped — turn “Keep the audio” on to keep the sound.');
  } else if (source.audioCodec && spec.remuxAudioCodecs.includes(source.audioCodec)) {
    audio = { path: 'remux', codec: source.audioCodec };
  } else if (!source.audioDecodable) {
    audio = { path: 'drop', codec: null };
    warnings.push(
      `The audio codec of this file is not stored reliably in ${spec.label} and cannot be re-encoded here, so the sound was left out.`,
    );
  } else {
    const codec =
      spec.audioEncodePreference.find((candidate) =>
        capabilities.encodableAudio.includes(candidate),
      ) ?? null;
    if (codec) {
      audio = { path: 'transcode', codec };
    } else {
      audio = { path: 'drop', codec: null };
      warnings.push(
        'This browser cannot encode audio, so the sound track was dropped from the converted file.',
      );
    }
  }

  return {
    container: prefs.container,
    extension: spec.extension,
    video,
    audio,
    bitrate: video.path === 'transcode' ? transcodeVideoBitrate(source) : null,
    warnings,
  };
}

/** Human name for a codec id, without needing the shared engine. */
function labelForVideoCodec(codec: string): string {
  const labels: Record<string, string> = {
    avc: 'H.264',
    hevc: 'H.265',
    vp8: 'VP8',
    vp9: 'VP9',
    av1: 'AV1',
    prores: 'ProRes',
  };
  return labels[codec] ?? codec.toUpperCase();
}

/* -------------------------------------------------------------------------- */
/*  Bitrate and size                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The video bitrate used when re-encoding: the source's own bitrate when the
 * container reports one, so a conversion keeps roughly the same quality, or a
 * sensible default when it does not.
 */
export function transcodeVideoBitrate(source: ConvertSource): number {
  const base =
    source.videoBitrate && Number.isFinite(source.videoBitrate) && source.videoBitrate > 0
      ? source.videoBitrate
      : CONVERT_DEFAULT_VIDEO_BITRATE;
  return Math.min(Math.max(Math.round(base), CONVERT_MIN_VIDEO_BITRATE), CONVERT_MAX_VIDEO_BITRATE);
}

/**
 * Rough size of the re-encoded result, in bytes — or `null` when the clip's
 * length is unknown and no estimate can be made.
 */
export function estimateTranscodeBytes(source: ConvertSource, plan: ConvertPlan): number | null {
  if (plan.bitrate == null || source.durationSeconds == null) return null;
  const audio =
    plan.audio.path === 'drop'
      ? 0
      : plan.audio.path === 'transcode'
        ? CONVERT_DEFAULT_AUDIO_BITRATE
        : 0;
  return Math.ceil(((plan.bitrate + audio) / 8) * source.durationSeconds);
}

/**
 * Guard the output size: the result is muxed into memory, so a run that would
 * produce half a gigabyte is refused up front instead of wedging the tab.
 * Returns the warnings to show the user.
 */
export function checkConvertOutputSize(source: ConvertSource, plan: ConvertPlan): string[] {
  const warnings: string[] = [];
  // A remux copies the bytes almost one-to-one; a transcode is estimated from
  // the bitrate and the clip's length.
  const estimate =
    plan.video.path === 'remux' ? source.fileSize : estimateTranscodeBytes(source, plan);
  if (estimate == null) {
    warnings.push(
      'The length of this clip could not be read, so the size of the converted file cannot be predicted.',
    );
    return warnings;
  }
  if (estimate > CONVERT_MAX_OUTPUT_BYTES) {
    throw new ToolError(
      `The converted file would be about ${estimate.toLocaleString('en-US')} bytes — more than the 512 MB this tool can build in memory.`,
      'Trim the clip first, or compress it with the Video Compressor.',
    );
  }
  if (estimate > CONVERT_WARN_OUTPUT_BYTES) {
    warnings.push(
      'The converted file is large and is held in memory until you download it — this may take a moment.',
    );
  }
  return warnings;
}

/* -------------------------------------------------------------------------- */
/*  Reporting                                                                  */
/* -------------------------------------------------------------------------- */

/** One-line description of what happens to the video stream. */
export function describeVideoPath(plan: ConvertPlan): string {
  if (plan.video.path === 'remux') {
    return `Remuxed (stream copy) — ${labelForVideoCodec(plan.video.codec ?? '')} copied without re-encoding`;
  }
  return `Re-encoded to ${labelForVideoCodec(plan.video.codec ?? '')}`;
}

/** One-line description of what happens to the audio track. */
export function describeAudioPath(plan: ConvertPlan): string {
  if (plan.audio.path === 'remux')
    return `Copied (${plan.audio.codec?.toUpperCase() ?? 'original'})`;
  if (plan.audio.path === 'transcode') return `Re-encoded to ${plan.audio.codec?.toUpperCase()}`;
  return 'Dropped';
}

/**
 * `holiday clip.mkv` → `holiday clip-converted.webm`.
 * Unicode is preserved and path separators are neutralised.
 */
export function convertOutputFilename(sourceName: string, extension: string): string {
  const cleaned = String(sourceName ?? '').replace(/[\\/]/g, '_');
  const base = cleaned.replace(/\.[^.]*$/, '').trim();
  const ext = String(extension ?? 'mp4').replace(/^\./, '') || 'mp4';
  return `${base || 'video'}-converted.${ext}`;
}
