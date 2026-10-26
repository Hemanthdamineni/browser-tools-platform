/**
 * Pure helpers for the video trimmer.
 *
 * Nothing in this module touches the DOM, the network or a codec: the time
 * parsing, the range validation, the copy/re-encode verdict and the report
 * builder are plain computations over the user's options and the facts we read
 * out of the container, so the whole thing is unit-testable in Node/jsdom.
 *
 * The browser-only parts — demuxing, copying the encoded packets or
 * re-encoding them — live in `video-trim.tool.ts`.
 */

import { ToolError } from '@/lib/types';
import { formatBytes } from '@/lib/format';
import { formatTimecode } from '@/lib/video';

/* -------------------------------------------------------------------------- */
/*  Limits                                                                     */
/* -------------------------------------------------------------------------- */

/** The shortest cut we accept — anything shorter cannot hold a whole frame. */
export const TRIM_MIN_SECONDS = 0.04;

/**
 * Hard ceiling on the input file. The trimmed clip is buffered in memory, so a
 * multi-gigabyte input would wedge the tab instead of being cut.
 */
export const TRIM_MAX_INPUT_BYTES = 2 * 1024 ** 3;

/* -------------------------------------------------------------------------- */
/*  Time parsing                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Parse a time into seconds.
 *
 * Accepts `SS` (`12`, `12.5`), `M:SS` (`1:30`) and `H:MM:SS` (`0:01:30`) —
 * the same notations the audio trimmer uses. Anything else is a `ToolError`,
 * because guessing a time would silently cut the wrong part of the clip.
 */
export function parseTrimTime(value: unknown, label = 'The time'): number {
  const raw = String(value ?? '').trim();
  const where = label === 'The time' ? '' : ` (${label.toLowerCase()})`;
  if (raw === '') {
    throw new ToolError(`${label} is empty.`, 'Enter a time such as 0:05 or 1:02:30.');
  }
  if (raw.startsWith('-')) {
    throw new ToolError(
      `${label} must be 0 seconds or more.`,
      'A cut cannot start before the clip does.',
    );
  }
  const parts = raw.split(':');
  if (parts.length > 3) {
    throw new ToolError(
      `Invalid time “${raw}”${where}.`,
      'Use SS, M:SS or H:MM:SS — for example 0:05 or 1:02:30.',
    );
  }
  if (!parts.every((part) => /^\d+(\.\d+)?$/.test(part))) {
    throw new ToolError(
      `Invalid time “${raw}”${where}.`,
      'Use SS, M:SS or H:MM:SS — for example 0:05 or 1:02:30.',
    );
  }
  // The seconds field never reaches 60; the minutes field may (90:00 is 90 minutes).
  const secondsField = Number(parts[parts.length - 1]);
  if (secondsField >= 60) {
    throw new ToolError(
      `Invalid time “${raw}”${where} — the seconds part must be below 60.`,
      'Write 1:30 for one minute and thirty seconds, not 1:90.',
    );
  }
  if (parts.length === 3 && Number(parts[1]) >= 60) {
    throw new ToolError(
      `Invalid time “${raw}”${where} — the minutes part must be below 60.`,
      'Write 0:01:30 for one minute and thirty seconds, not 0:90:30.',
    );
  }
  let seconds = 0;
  for (const part of parts) seconds = seconds * 60 + Number(part);
  return seconds;
}

/**
 * Format seconds back into the `M:SS` / `H:MM:SS` form {@link parseTrimTime}
 * accepts. Milliseconds are only shown when they matter.
 */
export function formatTrimTime(seconds: number): string {
  const totalMs = Math.max(0, Math.round((Number(seconds) || 0) * 1000));
  const ms = totalMs % 1000;
  const totalSeconds = (totalMs - ms) / 1000;
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number, width = 2): string => String(n).padStart(width, '0');
  const base = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  return ms > 0 ? `${base}.${pad(ms, 3)}` : base;
}

/* -------------------------------------------------------------------------- */
/*  Output container                                                           */
/* -------------------------------------------------------------------------- */

export type TrimFormatId = 'source' | 'mp4' | 'webm' | 'mkv';

export interface TrimFormatChoice {
  id: TrimFormatId;
  /** Shown in the option picker. */
  label: string;
  /** One-line explanation shown in the FAQ and the panel. */
  help: string;
}

/** The output containers the trimmer can write. */
export const TRIM_FORMATS: readonly TrimFormatChoice[] = [
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
    id: 'mkv',
    label: 'Matroska (MKV)',
    help: 'Holds almost any codec — the safe choice for unusual sources.',
  },
];

/** Look up an output container, failing loudly on an unknown value. */
export function resolveTrimFormat(value: unknown): TrimFormatChoice {
  const id = String(value ?? 'source').trim() || 'source';
  const found = TRIM_FORMATS.find((format) => format.id === id);
  if (!found) {
    throw new ToolError(
      `“${id}” is not a known output format.`,
      `Choose one of: ${TRIM_FORMATS.map((format) => format.id).join(', ')}.`,
    );
  }
  return found;
}

/** The concrete container the muxer writes. */
export interface TrimContainerSpec {
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
 * Matroska file. Everything else falls back to MP4, which is the format the
 * widest range of players understands.
 */
export function resolveContainerSpec(
  format: TrimFormatChoice,
  sourceFormatName: string | null | undefined,
): TrimContainerSpec {
  if (format.id === 'mp4') {
    return { kind: 'mp4', extension: '.mp4', mimeType: 'video/mp4', label: 'MP4' };
  }
  if (format.id === 'webm') {
    return { kind: 'webm', extension: '.webm', mimeType: 'video/webm', label: 'WebM' };
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

export type TrimCopyMode = 'preferred' | 'forced' | 'never';

export interface TrimCopyModeChoice {
  id: TrimCopyMode;
  label: string;
  help: string;
}

/**
 * The three ways the trimmer can cut.
 *
 * - `preferred` copies the encoded packets whenever the container and codec
 *   allow it, and re-encodes only the parts that have to be re-encoded.
 * - `forced` never re-encodes: a track that cannot be copied is left out.
 * - `never` always decodes and encodes the clip again.
 */
export const TRIM_COPY_MODES: readonly TrimCopyModeChoice[] = [
  {
    id: 'preferred',
    label: 'Copy when possible (recommended)',
    help: 'The encoded packets are copied untouched; whatever cannot be copied is re-encoded.',
  },
  {
    id: 'forced',
    label: 'Copy only — leave out what cannot be copied',
    help: 'Never re-encodes. Tracks that cannot be copied are dropped from the result.',
  },
  {
    id: 'never',
    label: 'Always re-encode',
    help: 'Decodes and encodes the clip again. Slower, and the result is not bit-identical.',
  },
];

/** Look up the copy strategy, failing loudly on an unknown value. */
export function resolveCopyMode(value: unknown): TrimCopyMode {
  const id = String(value ?? 'preferred').trim() || 'preferred';
  const found = TRIM_COPY_MODES.find((mode) => mode.id === id);
  if (!found) {
    throw new ToolError(
      `“${id}” is not a known way to cut.`,
      `Choose one of: ${TRIM_COPY_MODES.map((mode) => mode.id).join(', ')}.`,
    );
  }
  return found.id;
}

/** Where the copied media may start and end relative to the requested range. */
export type TrimBoundaryPolicy = 'expand' | 'shrink';

/* -------------------------------------------------------------------------- */
/*  Settings                                                                   */
/* -------------------------------------------------------------------------- */

/** What we know about the source clip before the cut can be planned. */
export interface TrimSourceInfo {
  /** Container duration in seconds, or `null` when it could not be read. */
  durationSeconds: number | null;
  /** The container name as reported by the engine, e.g. "MP4". */
  formatName: string;
}

export interface TrimSettings {
  /** First second of the clip that is kept. */
  startSeconds: number;
  /** Last second of the clip that is kept (exclusive). */
  endSeconds: number;
  /** Length of the selected range. */
  rangeSeconds: number;
  /** The output container the user asked for. */
  format: TrimFormatChoice;
  /** The copy strategy the user asked for. */
  copyMode: TrimCopyMode;
  /** Whether the audio track is kept. */
  keepAudio: boolean;
  /** Whether the copied media may spill over the requested range. */
  boundaryPolicy: TrimBoundaryPolicy;
}

/**
 * Read a time option.
 *
 * An empty value means "not set" — the caller decides what that means (the
 * start of the clip, or the end of it).
 */
function readTime(value: unknown, fallback: number | null, label: string): number | null {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') {
    throw new ToolError(`${label} must be a time.`, 'Use SS, M:SS or H:MM:SS — for example 0:05.');
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new ToolError(
        `${label} must be a time.`,
        'Use SS, M:SS or H:MM:SS — for example 0:05.',
      );
    }
    if (value < 0) {
      throw new ToolError(
        `${label} must be 0 seconds or more.`,
        'A cut cannot start before the clip does.',
      );
    }
    return value;
  }
  const raw = String(value).trim();
  if (raw === '') return fallback;
  return parseTrimTime(raw, label);
}

/**
 * Validate the user's options and turn them into a concrete cut plan.
 *
 * Every failure is a `ToolError` with a human hint: an out-of-range range, a
 * negative start or an unparseable time must never silently cut the wrong
 * part of the clip.
 */
export function resolveTrimSettings(
  options: Record<string, string | number | boolean | undefined>,
  source: TrimSourceInfo,
): TrimSettings {
  const format = resolveTrimFormat(options.format);
  const copyMode = resolveCopyMode(options.copyMode);
  const keepAudio = options.keepAudio !== false && options.keepAudio !== 'false';
  const boundary: TrimBoundaryPolicy = options.boundary === 'shrink' ? 'shrink' : 'expand';

  const start = readTime(options.start, 0, 'The start time') ?? 0;
  const requestedEnd = readTime(options.end, null, 'The end time');
  const duration = source.durationSeconds;

  let end: number;
  if (duration == null) {
    if (requestedEnd == null) {
      throw new ToolError(
        'The length of this clip could not be read, so the cut cannot be applied.',
        'Re-export the video, or pick a file whose container reports a duration.',
      );
    }
    end = requestedEnd;
  } else {
    if (duration <= 0) {
      throw new ToolError(
        'This clip has no duration, so there is nothing to trim.',
        'Re-export the video — the file may be truncated.',
      );
    }
    if (start >= duration) {
      throw new ToolError(
        `The start time (${formatTrimTime(start)}) is past the end of the clip (${formatTrimTime(duration)}).`,
        'Use 0:00 to start at the beginning.',
      );
    }
    if (requestedEnd != null && requestedEnd > duration) {
      throw new ToolError(
        `The end time (${formatTrimTime(requestedEnd)}) is past the end of the clip (${formatTrimTime(duration)}).`,
        'Leave the end time empty to cut to the end of the clip.',
      );
    }
    end = requestedEnd ?? duration;
  }

  if (end <= start) {
    throw new ToolError(
      'The start time must be before the end time.',
      'Move the in point earlier or the out point later.',
    );
  }
  const rangeSeconds = end - start;
  if (rangeSeconds < TRIM_MIN_SECONDS) {
    throw new ToolError(
      `The cut is only ${rangeSeconds.toFixed(3)} s long — too short to hold a frame.`,
      'Make the range at least a few tenths of a second long.',
    );
  }

  return {
    startSeconds: start,
    endSeconds: end,
    rangeSeconds,
    format,
    copyMode,
    keepAudio,
    boundaryPolicy: boundary,
  };
}

/* -------------------------------------------------------------------------- */
/*  Copy vs re-encode                                                          */
/* -------------------------------------------------------------------------- */

/** What we know about one track of the conversion. */
export interface TrimTrackFacts {
  /** Codec string of the track in the source file, e.g. "avc1.640028". */
  inputCodec: string | null;
  /** Codec string of the track in the trimmed file. */
  outputCodec: string | null;
  /** Whether the encoded packets were copied instead of being re-encoded. */
  copied: boolean;
}

/** How one track came out of the conversion. */
export type TrimTrackState = 'copied' | 'reencoded' | 'unknown';

/** A track the conversion left out, and why. */
export interface TrimDiscardedTrack {
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

export interface TrimModeFacts {
  /** Facts about the video track. */
  video: TrimTrackFacts;
  /** Facts about the audio track, or `null` when there is none in the output. */
  audio: TrimTrackFacts | null;
  /** The copy strategy the conversion ran with. */
  copyMode: TrimCopyMode;
  /** Tracks that were left out of the output. */
  discarded?: TrimDiscardedTrack[];
}

export interface TrimModeVerdict {
  /** `copy` — every track was copied; `reencode` — one was re-encoded; `mixed` — some of each. */
  kind: 'copy' | 'reencode' | 'mixed';
  /** True only when every track was copied *and* its codec string is unchanged. */
  lossless: boolean;
  /** One sentence explaining what happened, for the report. */
  label: string;
  /** The state of the video track. */
  video: TrimTrackState;
  /** The state of the audio track, or `absent` when there is none. */
  audio: TrimTrackState | 'absent';
}

/** Codec strings are compared case-insensitively — they are not case sensitive. */
function sameCodec(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Decide what a single track came out as.
 *
 * A track only counts as *copied* when the packets really were copied **and**
 * the codec string did not change: a re-encode that happens to land on the
 * same codec string must not be reported as a lossless stream copy.
 */
function trackState(facts: TrimTrackFacts): TrimTrackState {
  if (!facts.copied) return 'reencoded';
  if (facts.inputCodec && facts.outputCodec) {
    return sameCodec(facts.inputCodec, facts.outputCodec) ? 'copied' : 'reencoded';
  }
  return 'unknown';
}

/**
 * Turn the facts of a finished conversion into the verdict the user sees.
 *
 * The verdict is deliberately conservative: it only claims a lossless stream
 * copy when every track was copied and every codec string is unchanged.
 */
export function classifyTrimMode(facts: TrimModeFacts): TrimModeVerdict {
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

  const states = [video, audio].filter((state): state is TrimTrackState => state !== 'absent');
  const copied = states.filter((state) => state === 'copied').length;
  const reencoded = states.filter((state) => state === 'reencoded').length;
  const unknown = states.filter((state) => state === 'unknown').length;

  const kind: TrimModeVerdict['kind'] =
    reencoded === 0 ? 'copy' : copied === 0 ? 'reencode' : 'mixed';
  const lossless = kind === 'copy' && unknown === 0;

  let label: string;
  if (lossless) {
    label = 'Stream copy — the encoded packets were copied untouched, so the cut is lossless.';
  } else if (kind === 'copy') {
    label = 'Stream copy — the encoded packets were reused, but the codec could not be verified.';
  } else if (kind === 'mixed') {
    label = 'Mixed — some tracks were copied, others were re-encoded.';
  } else {
    label = 'Re-encoded — the clip was decoded and encoded again.';
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

/** `holiday clip.mp4` → `holiday clip-trim.mp4` (Unicode is preserved as-is). */
export function trimOutputFilename(sourceName: string, extension: string): string {
  const cleaned = String(sourceName ?? '').replace(/[\\/]/g, '_');
  const base = cleaned.replace(/\.[^.]*$/, '').trim();
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return `${base || 'video'}-trim${ext}`;
}

/* -------------------------------------------------------------------------- */
/*  Report                                                                     */
/* -------------------------------------------------------------------------- */

export interface TrimReportFacts {
  /** Name of the input file. */
  fileName: string;
  /** Size of the input file in bytes. */
  inputSizeBytes: number;
  /** Size of the trimmed file in bytes. */
  outputSizeBytes: number;
  /** Duration of the input clip, or `null` when it could not be read. */
  inputDurationSeconds: number | null;
  /** First second of the clip that was kept. */
  startSeconds: number;
  /** Last second of the clip that was kept. */
  endSeconds: number;
  /** Length of the kept range. */
  rangeSeconds: number;
  /** The container that was written. */
  container: TrimContainerSpec;
  /** The copy/re-encode verdict. */
  verdict: TrimModeVerdict;
  /** Codec string of the video track before and after the cut. */
  inputVideoCodec: string | null;
  outputVideoCodec: string | null;
  /** Codec string of the audio track before and after the cut. */
  inputAudioCodec: string | null;
  outputAudioCodec: string | null;
  /** Tracks that were left out of the output. */
  discarded: TrimDiscardedTrack[];
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
  state: TrimTrackState | 'absent',
): string {
  if (state === 'absent') return 'Dropped';
  const from = input ?? 'unknown';
  if (input && output && !sameCodec(input, output)) {
    return `${from} → ${output} (re-encoded)`;
  }
  if (state === 'copied') return `${from} (unchanged — copied)`;
  if (state === 'unknown') return `${from} → ${output ?? 'unknown'} (copied, codec not verified)`;
  return `${from} → ${output ?? 'unknown'} (re-encoded)`;
}

/** Turn the facts of a finished cut into the `render: 'table'` payload. */
export function buildTrimReport(facts: TrimReportFacts): {
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
    [
      'Selected range',
      `${formatTimecode(facts.startSeconds)} – ${formatTimecode(facts.endSeconds)}`,
    ],
    ['Output duration', formatTimecode(facts.rangeSeconds)],
    ['Output container', `${facts.container.label} (${facts.container.mimeType})`],
    ['How the cut was made', facts.verdict.label],
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
