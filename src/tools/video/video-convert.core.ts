/**
 * Pure helpers for the video converter.
 *
 * Nothing in this module touches the DOM, the network or a codec: the
 * container resolution, the remux/re-encode verdict and the report builder are
 * plain computations over the user's options and the facts we read out of the
 * container, so the whole thing is unit-testable in Node/jsdom.
 *
 * The browser-only parts — demuxing, remuxing the encoded packets or
 * re-encoding them — live in `video-convert.tool.ts`.
 */

import { ToolError } from '@/lib/types';
import { formatBytes } from '@/lib/format';
import { formatTimecode } from '@/lib/video';

/* -------------------------------------------------------------------------- */
/*  Limits                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Hard ceiling on the input file. The converted file is buffered in memory, so
 * a multi-gigabyte input would wedge the tab instead of being converted.
 */
export const CONVERT_MAX_INPUT_BYTES = 2 * 1024 ** 3;

/* -------------------------------------------------------------------------- */
/*  Output container                                                           */
/* -------------------------------------------------------------------------- */

export type ConvertFormatId = 'source' | 'mp4' | 'webm' | 'mov' | 'mkv';

export interface ConvertFormatChoice {
  id: ConvertFormatId;
  /** Shown in the option picker. */
  label: string;
  /** One-line explanation shown in the FAQ and the panel. */
  help: string;
}

/** The output containers the converter can write. */
export const CONVERT_FORMATS: readonly ConvertFormatChoice[] = [
  {
    id: 'source',
    label: 'Same as the source',
    help: 'Keeps the container of the input file — the fastest and most lossless option.',
  },
  {
    id: 'mp4',
    label: 'MP4',
    help: 'H.264 / HEVC in an MP4 container. Plays almost everywhere.',
  },
  {
    id: 'webm',
    label: 'WebM',
    help: 'VP8 / VP9 / AV1 with Opus audio. An open format, web friendly.',
  },
  {
    id: 'mov',
    label: 'QuickTime (MOV)',
    help: 'The Mac-native container. Holds the same codecs as MP4.',
  },
  {
    id: 'mkv',
    label: 'Matroska (MKV)',
    help: 'Holds almost any codec — the safe choice for unusual sources.',
  },
];

/** Look up an output container, failing loudly on an unknown value. */
export function resolveConvertFormat(value: unknown): ConvertFormatChoice {
  const id = String(value ?? 'source').trim() || 'source';
  const found = CONVERT_FORMATS.find((format) => format.id === id);
  if (!found) {
    throw new ToolError(
      `“${id}” is not a known output format.`,
      `Choose one of: ${CONVERT_FORMATS.map((format) => format.id).join(', ')}.`,
    );
  }
  return found;
}

/** The concrete container the muxer writes. */
export interface ConvertContainerSpec {
  /** Which Mediabunny output format to build. */
  kind: 'mp4' | 'mov' | 'webm' | 'mkv';
  /** File extension, including the dot. */
  extension: string;
  /** MIME type of the produced file. */
  mimeType: string;
  /** Human label for the report. */
  label: string;
}

/**
 * Work out the container to write.
 *
 * `source` follows the input: a WebM stays a WebM, a Matroska file stays a
 * Matroska file, a QuickTime movie stays a QuickTime movie. Everything else
 * falls back to MP4, which is the format the widest range of players
 * understands.
 */
export function resolveContainerSpec(
  format: ConvertFormatChoice,
  sourceFormatName: string | null | undefined,
): ConvertContainerSpec {
  if (format.id === 'mp4') {
    return { kind: 'mp4', extension: '.mp4', mimeType: 'video/mp4', label: 'MP4' };
  }
  if (format.id === 'webm') {
    return { kind: 'webm', extension: '.webm', mimeType: 'video/webm', label: 'WebM' };
  }
  if (format.id === 'mov') {
    return { kind: 'mov', extension: '.mov', mimeType: 'video/quicktime', label: 'QuickTime' };
  }
  if (format.id === 'mkv') {
    return { kind: 'mkv', extension: '.mkv', mimeType: 'video/x-matroska', label: 'Matroska' };
  }
  const name = String(sourceFormatName ?? '').toLowerCase();
  if (name.includes('webm')) {
    return { kind: 'webm', extension: '.webm', mimeType: 'video/webm', label: 'WebM' };
  }
  if (name.includes('matroska')) {
    return { kind: 'mkv', extension: '.mkv', mimeType: 'video/x-matroska', label: 'Matroska' };
  }
  if (name.includes('quicktime')) {
    return { kind: 'mov', extension: '.mov', mimeType: 'video/quicktime', label: 'QuickTime' };
  }
  return { kind: 'mp4', extension: '.mp4', mimeType: 'video/mp4', label: 'MP4' };
}

/* -------------------------------------------------------------------------- */
/*  Copy strategy                                                              */
/* -------------------------------------------------------------------------- */

export type ConvertCopyMode = 'preferred' | 'forced' | 'never';

export interface ConvertCopyModeChoice {
  id: ConvertCopyMode;
  label: string;
  help: string;
}

/**
 * The three ways the converter can work.
 *
 * - `preferred` remuxes the encoded packets whenever the container and codec
 *   allow it, and re-encodes only the parts that have to be re-encoded.
 * - `forced` never re-encodes: a track that cannot be remuxed is left out.
 * - `never` always decodes and encodes the media again.
 */
export const CONVERT_COPY_MODES: readonly ConvertCopyModeChoice[] = [
  {
    id: 'preferred',
    label: 'Remux when possible (recommended)',
    help: 'The encoded packets are copied untouched; whatever cannot be remuxed is re-encoded.',
  },
  {
    id: 'forced',
    label: 'Remux only — leave out what cannot be remuxed',
    help: 'Never re-encodes. Tracks that cannot be remuxed are dropped from the result.',
  },
  {
    id: 'never',
    label: 'Always re-encode',
    help: 'Decodes and encodes the media again. Slower, and the result is not bit-identical.',
  },
];

/** Look up the copy strategy, failing loudly on an unknown value. */
export function resolveCopyMode(value: unknown): ConvertCopyMode {
  const id = String(value ?? 'preferred').trim() || 'preferred';
  const found = CONVERT_COPY_MODES.find((mode) => mode.id === id);
  if (!found) {
    throw new ToolError(
      `“${id}” is not a known way to convert.`,
      `Choose one of: ${CONVERT_COPY_MODES.map((mode) => mode.id).join(', ')}.`,
    );
  }
  return found.id;
}

/* -------------------------------------------------------------------------- */
/*  Settings                                                                   */
/* -------------------------------------------------------------------------- */

/** What we know about the source clip before the conversion can be planned. */
export interface ConvertSourceInfo {
  /** The container name as reported by the engine, e.g. "MP4". */
  formatName: string;
}

export interface ConvertSettings {
  /** The output container the user asked for. */
  format: ConvertFormatChoice;
  /** The copy strategy the user asked for. */
  copyMode: ConvertCopyMode;
  /** Whether the audio track is kept. */
  keepAudio: boolean;
}

/**
 * Validate the user's options and turn them into a concrete conversion plan.
 *
 * Every failure is a `ToolError` with a human hint: an unknown container or
 * copy mode must never silently pick the wrong output.
 */
export function resolveConvertSettings(
  options: Record<string, string | number | boolean | undefined>,
  source: ConvertSourceInfo,
): ConvertSettings {
  const format = resolveConvertFormat(options.format);
  const copyMode = resolveCopyMode(options.copyMode);
  const keepAudio = options.keepAudio !== false && options.keepAudio !== 'false';
  void source; // kept in the signature for symmetry with the other video tools
  return { format, copyMode, keepAudio };
}

/* -------------------------------------------------------------------------- */
/*  Remux vs re-encode                                                          */
/* -------------------------------------------------------------------------- */

/** What we know about one track of the conversion. */
export interface ConvertTrackFacts {
  /** Codec string of the track in the source file, e.g. "avc1.640028". */
  inputCodec: string | null;
  /** Codec string of the track in the converted file. */
  outputCodec: string | null;
  /** Whether the encoded packets were remuxed instead of being re-encoded. */
  copied: boolean;
}

/** How one track came out of the conversion. */
export type ConvertTrackState = 'copied' | 'reencoded' | 'unknown';

/** A track the conversion left out, and why. */
export interface ConvertDiscardedTrack {
  type: 'video' | 'audio' | 'subtitle';
  reason: string;
}

/** The engine's discard reasons, in words a person can read. */
const DISCARD_REASONS: Record<string, string> = {
  discarded_by_user: 'it was left out on purpose',
  max_track_count_reached: 'the output has no room for more tracks',
  max_track_count_of_type_reached: 'the output container cannot hold a second track of this kind',
  unknown_source_codec: 'the codec of the track is not known',
  undecodable_source_codec: 'this browser cannot decode the codec of the track',
  no_encodable_target_codec: 'this browser cannot encode a codec the output container accepts',
  cannot_copy: 'it cannot be copied into the chosen output container',
};

/** Turn the engine's discard reason into something a person can read. */
export function describeDiscardReason(reason: string): string {
  return DISCARD_REASONS[reason] ?? reason;
}

export interface ConvertModeFacts {
  /** Facts about the video track. */
  video: ConvertTrackFacts;
  /** Facts about the audio track, or `null` when there is none in the output. */
  audio: ConvertTrackFacts | null;
  /** The copy strategy the conversion ran with. */
  copyMode: ConvertCopyMode;
  /** Tracks that were left out of the output. */
  discarded?: ConvertDiscardedTrack[];
}

export interface ConvertModeVerdict {
  /** `copy` — every track was remuxed; `reencode` — one was re-encoded; `mixed` — some of each. */
  kind: 'copy' | 'reencode' | 'mixed';
  /** True only when every track was remuxed *and* its codec string is unchanged. */
  lossless: boolean;
  /** One sentence explaining what happened, for the report. */
  label: string;
  /** The state of the video track. */
  video: ConvertTrackState;
  /** The state of the audio track, or `absent` when there is none. */
  audio: ConvertTrackState | 'absent';
}

/** Codec strings are compared case-insensitively — they are not case sensitive. */
const sameCodec = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Decide what a single track came out as.
 *
 * A track only counts as *remuxed* when the packets really were copied **and**
 * the codec string did not change: a re-encode that happens to land on the
 * same codec string must not be reported as a lossless remux.
 */
function trackState(facts: ConvertTrackFacts): ConvertTrackState {
  if (!facts.copied) return 'reencoded';
  if (facts.inputCodec && facts.outputCodec) {
    return sameCodec(facts.inputCodec, facts.outputCodec) ? 'copied' : 'reencoded';
  }
  return 'unknown';
}

/**
 * Turn the facts of a finished conversion into the verdict the user sees.
 *
 * The verdict is deliberately conservative: it only claims a lossless remux
 * when every track was copied and every codec string is unchanged.
 */
export function classifyConvertMode(facts: ConvertModeFacts): ConvertModeVerdict {
  // `never` asks for a re-encode, so nothing can have been copied.
  const video = facts.copyMode === 'never' ? 'reencoded' : trackState(facts.video);
  const audio =
    facts.copyMode === 'never'
      ? facts.audio
        ? 'reencoded'
        : 'absent'
      : facts.audio
        ? trackState(facts.audio)
        : 'absent';

  const states = [video, audio].filter((state): state is ConvertTrackState => state !== 'absent');
  const copied = states.filter((state) => state === 'copied').length;
  const reencoded = states.filter((state) => state === 'reencoded').length;
  const unknown = states.filter((state) => state === 'unknown').length;

  const kind: ConvertModeVerdict['kind'] =
    reencoded === 0 ? 'copy' : copied === 0 ? 'reencode' : 'mixed';
  const lossless = kind === 'copy' && unknown === 0;

  let label: string;
  if (lossless) {
    label = 'Remux — the encoded packets were copied untouched, so the conversion is lossless.';
  } else if (kind === 'copy') {
    label = 'Remux — the encoded packets were reused, but the codec could not be verified.';
  } else if (kind === 'mixed') {
    label = 'Mixed — some tracks were remuxed, others were re-encoded.';
  } else {
    label = 'Re-encoded — the media was decoded and encoded again.';
  }

  const discarded = facts.discarded ?? [];
  if (discarded.length) {
    const names = discarded.map((track) => track.type).join(' and ');
    label += ` The ${names} track was left out because ${describeDiscardReason(discarded[0]!.reason)}.`;
  }

  return { kind, lossless, label, video, audio };
}

/* -------------------------------------------------------------------------- */
/*  File name                                                                  */
/* -------------------------------------------------------------------------- */

/** `holiday clip.mp4` → `holiday clip.webm` — a conversion replaces the extension. */
export function convertOutputFilename(sourceName: string, extension: string): string {
  const cleaned = String(sourceName ?? '').replace(/[\\/]/g, '_');
  const base = cleaned.replace(/\.[^.]*$/, '').trim();
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return `${base || 'video'}${ext}`;
}

/* -------------------------------------------------------------------------- */
/*  Report                                                                     */
/* -------------------------------------------------------------------------- */

export interface ConvertReportFacts {
  /** Name of the input file. */
  fileName: string;
  /** Size of the input file in bytes. */
  inputSizeBytes: number;
  /** Size of the converted file in bytes. */
  outputSizeBytes: number;
  /** Duration of the input clip, or `null` when it could not be read. */
  inputDurationSeconds: number | null;
  /** The container that was written. */
  container: ConvertContainerSpec;
  /** The remux/re-encode verdict. */
  verdict: ConvertModeVerdict;
  /** Codec string of the video track before and after the conversion. */
  inputVideoCodec: string | null;
  outputVideoCodec: string | null;
  /** Codec string of the audio track before and after the conversion. */
  inputAudioCodec: string | null;
  outputAudioCodec: string | null;
  /** Tracks that were left out of the output. */
  discarded: ConvertDiscardedTrack[];
}

/**
 * `avc1.640028 → avc1.640028 (unchanged)` — one row of the report.
 *
 * The codec strings decide what the row says: when they differ, the track was
 * re-encoded, whatever the engine reported about the packets.
 */
function codecRow(
  input: string | null,
  output: string | null,
  state: ConvertTrackState | 'absent',
): string {
  if (state === 'absent') return 'Dropped';
  const from = input ?? 'unknown';
  if (input && output && !sameCodec(input, output)) {
    return `${from} → ${output} (re-encoded)`;
  }
  if (state === 'copied') return `${from} (unchanged — remuxed)`;
  if (state === 'unknown') return `${from} → ${output ?? 'unknown'} (remuxed, codec not verified)`;
  return `${from} → ${output ?? 'unknown'} (re-encoded)`;
}

/** Turn the facts of a finished conversion into the `render: 'table'` payload. */
export function buildConvertReport(facts: ConvertReportFacts): {
  headers: string[];
  rows: string[][];
} {
  const saved = facts.inputSizeBytes - facts.outputSizeBytes;
  const rows: string[][] = [
    ['File name', facts.fileName],
    ['Input size', formatBytes(facts.inputSizeBytes)],
    ['Output size', formatBytes(facts.outputSizeBytes)],
    [
      'Size change',
      saved === 0
        ? 'unchanged'
        : saved > 0
          ? `${formatBytes(saved)} smaller`
          : `${formatBytes(-saved)} larger`,
    ],
    [
      'Input duration',
      facts.inputDurationSeconds == null
        ? 'Not available'
        : formatTimecode(facts.inputDurationSeconds),
    ],
    ['Output container', `${facts.container.label} (${facts.container.mimeType})`],
    ['How the conversion was made', facts.verdict.label],
    ['Video codec', codecRow(facts.inputVideoCodec, facts.outputVideoCodec, facts.verdict.video)],
    ['Audio codec', codecRow(facts.inputAudioCodec, facts.outputAudioCodec, facts.verdict.audio)],
  ];

  if (facts.discarded.length) {
    rows.push([
      'Tracks left out',
      facts.discarded
        .map((track) => `${track.type} — ${describeDiscardReason(track.reason)}`)
        .join(', '),
    ]);
  }

  return { headers: ['Property', 'Value'], rows };
}
