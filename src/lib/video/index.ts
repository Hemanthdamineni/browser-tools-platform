/**
 * Shared, lazy-loaded video engine.
 *
 * Every video tool funnels through this module so the heavy work happens in one
 * reviewed place:
 *
 *   - **Lazy.** Mediabunny (MPL-2.0) is pulled in with a dynamic `import()`
 *     exactly once, on the first run of a video tool. It is ~180 KB gzipped and
 *     must never end up in the main bundle, and never be fetched at page load.
 *   - **WebCodecs first.** Container reading is plain demuxing (works anywhere,
 *     including offline), while decoding/encoding prefers the browser's
 *     `VideoDecoder`/`VideoEncoder`. When WebCodecs is missing we say so
 *     explicitly instead of failing at an opaque point later.
 *   - **Worker-safe.** Only `globalThis` is touched — no `window`, no DOM. Input
 *     arrives as a `File` (structured-cloneable), and file tools already run
 *     inside `tool.worker.ts`, so `probeVideoFile` normally executes off the
 *     main thread.
 *   - **Interruptible.** Long reads report `onProgress(fraction, message)` and
 *     honour an `AbortSignal`. A hard size ceiling turns an oversized file into
 *     a clear `ToolError` instead of a dead tab.
 *
 * Privacy: nothing here ever leaves the device. The only network activity is the
 * browser fetching this app's own lazily-loaded chunks.
 */

import { ToolError } from '@/lib/types';
import { formatBytes } from '@/lib/format';

/** The Mediabunny module shape, imported as a type only so nothing is bundled eagerly. */
export type VideoEngine = typeof import('mediabunny');

export interface VideoRunContext {
  signal?: AbortSignal;
  onProgress?: (fraction: number, message?: string) => void;
}

/* -------------------------------------------------------------------------- */
/*  Lazy loader                                                               */
/* -------------------------------------------------------------------------- */

let enginePromise: Promise<VideoEngine> | null = null;

/**
 * Import the video engine, once. Cached for the lifetime of the realm, and
 * cached *per realm* — the worker and the main thread each load their own copy,
 * which is exactly what we want.
 */
export function loadVideoEngine(): Promise<VideoEngine> {
  if (!enginePromise) {
    enginePromise = import('mediabunny').catch(() => {
      // Allow a retry after a transient failure (e.g. the tab was offline
      // mid-download of the chunk).
      enginePromise = null;
      throw new ToolError(
        'The video engine could not be loaded.',
        'Reload the page and try again — the engine is served from this app, not the network.',
      );
    });
  }
  return enginePromise;
}

/** Whether the engine has already been downloaded in this realm (for loading UI). */
export function isVideoEngineLoaded(): boolean {
  return enginePromise !== null;
}

/* -------------------------------------------------------------------------- */
/*  Capabilities                                                              */
/* -------------------------------------------------------------------------- */

/** True when the browser exposes WebCodecs video decoding. */
export function isWebCodecsAvailable(): boolean {
  return typeof globalThis.VideoDecoder === 'function';
}

export interface VideoCapabilities {
  /** Whether the browser exposes WebCodecs at all. */
  webCodecs: boolean;
  /** Video codecs this browser can decode. */
  decodable: string[];
  /** Video codecs this browser can encode (drives every export tool). */
  encodable: string[];
}

/** Probe what this browser can actually decode/encode. Requires the engine. */
export async function videoCapabilities(): Promise<VideoCapabilities> {
  if (!isWebCodecsAvailable()) return { webCodecs: false, decodable: [], encodable: [] };
  const engine = await loadVideoEngine();
  const [decodable, encodable] = await Promise.all([
    engine.getDecodableVideoCodecs(),
    engine.getEncodableVideoCodecs(),
  ]);
  return { webCodecs: true, decodable, encodable };
}

/**
 * Pick the first encoder the browser supports from `preferred`, then fall back
 * to *any* encodable codec. Returns `null` when WebCodecs encoding is unusable.
 * This is the single decision point for "WebCodecs first, sensible fallback"
 * that later export tools (trim/compress/convert) rely on.
 */
export async function chooseVideoEncoder(
  preferred: string[],
  options: { width?: number; height?: number; frameRate?: number } = {},
): Promise<string | null> {
  if (!isWebCodecsAvailable()) return null;
  const engine = await loadVideoEngine();
  const wanted = preferred.filter((c): c is (typeof engine.VIDEO_CODECS)[number] =>
    (engine.VIDEO_CODECS as readonly string[]).includes(c),
  );
  const first = await engine.getFirstEncodableVideoCodec(wanted, options);
  if (first) return first;
  const anyDecodable = await engine.getEncodableVideoCodecs(undefined, options);
  return anyDecodable[0] ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Limits                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Probing streams from the file and tolerates very large media, so this is a
 * sanity ceiling rather than a memory bound. Decoding/encoding tools pass a
 * much smaller budget.
 */
export const VIDEO_PROBE_MAX_BYTES = 8 * 1024 ** 3;

/** Largest single decoded frame we allow, in pixels (~256 MB as 4-byte RGBA). */
export const DECODE_PIXEL_BUDGET = 64 * 1024 * 1024;

/**
 * Validate a user-selected video file before any work starts: empty files and
 * files past the ceiling fail loudly and cheaply.
 */
export function assertVideoFile(file: Blob | null | undefined, maxBytes?: number): void {
  if (!file) throw new ToolError('Choose a video file.');
  if (file.size === 0) throw new ToolError('That file is empty (0 bytes).');
  const max = maxBytes ?? VIDEO_PROBE_MAX_BYTES;
  if (file.size > max) {
    throw new ToolError(
      `That file is ${formatBytes(file.size)}, larger than the ${formatBytes(max)} limit.`,
      'Use a shorter clip or a lower-resolution export.',
    );
  }
}

/**
 * Refuse a frame that would blow the tab's memory. Decode-heavy tools call this
 * with the real (display) dimensions before allocating anything.
 */
export function assertDecodeBudget(width: number, height: number): void {
  const bad = !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0;
  if (bad) throw new ToolError('This video reports invalid frame dimensions.');
  if (width * height > DECODE_PIXEL_BUDGET) {
    throw new ToolError(
      `This video frame is ${width} × ${height} — more pixels than this tool can decode safely.`,
      'Downscale or trim the clip first.',
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  Probe                                                                     */
/* -------------------------------------------------------------------------- */

export interface VideoTrackInfo {
  index: number;
  codec: string | null;
  codecString: string | null;
  codedWidth: number;
  codedHeight: number;
  displayWidth: number;
  displayHeight: number;
  rotation: number;
  /** Estimated frames per second, or `null` when no packet scan was requested. */
  frameRate: number | null;
  averageBitrate: number | null;
  /** Whether this browser can decode the track (false without WebCodecs). */
  decodable: boolean;
  language: string | null;
}

export interface AudioTrackInfo {
  index: number;
  codec: string | null;
  codecString: string | null;
  channels: number;
  sampleRate: number;
  averageBitrate: number | null;
  decodable: boolean;
  language: string | null;
}

export interface VideoTags {
  title?: string;
  artist?: string;
  album?: string;
  date?: string;
  comment?: string;
}

export interface VideoProbe {
  fileName: string;
  fileSize: number;
  /** Human container name, e.g. "MP4", "WebM", "Matroska". */
  format: string;
  /** Typical MIME base for the container, e.g. "video/mp4". */
  formatMime: string;
  /** Full MIME with codec parameters when the engine can derive it. */
  mimeType: string;
  /** Duration in seconds, or `null` when the file does not expose it. */
  durationSeconds: number | null;
  /** Whether the duration came from container metadata rather than a scan. */
  durationFromMetadata: boolean;
  videoTracks: VideoTrackInfo[];
  audioTracks: AudioTrackInfo[];
  tags: VideoTags | null;
  /** Whether the host realm exposes WebCodecs video decoding. */
  webCodecs: boolean;
}

export interface VideoProbeOptions extends VideoRunContext {
  /** Scan packets to estimate frame rate and to compute missing bitrates. */
  scanFrames?: boolean;
  /** Read container-level title/artist/date tags. */
  readTags?: boolean;
  /** Check decodability of each track (needs WebCodecs; default true). */
  checkDecode?: boolean;
  /** Override the file-size ceiling. */
  maxBytes?: number;
}

/** Number of packets inspected when `scanFrames` is on. Keeps the scan bounded. */
const FRAME_SCAN_PACKETS = 256;

/** Collect and validate everything a video tool needs to know about a file. */
export async function probeVideoFile(
  file: File,
  options: VideoProbeOptions = {},
): Promise<VideoProbe> {
  assertVideoFile(file, options.maxBytes);
  options.onProgress?.(0.05, 'Loading video engine');
  const engine = await loadVideoEngine();
  return probeVideoFileWith(engine, file, options);
}

/**
 * Same as {@link probeVideoFile}, but with the engine injected. The seam exists
 * so unit tests can exercise every branch (unsupported, audio-only, truncated,
 * cancelled) without a real browser codec.
 */
export async function probeVideoFileWith(
  engine: VideoEngine,
  file: File,
  options: VideoProbeOptions = {},
): Promise<VideoProbe> {
  const { signal, onProgress, scanFrames = false, readTags = true, checkDecode = true } = options;
  assertVideoFile(file, options.maxBytes);
  throwIfAborted(signal);

  const input = new engine.Input({
    formats: engine.ALL_FORMATS,
    source: new engine.BlobSource(file),
  });

  try {
    onProgress?.(0.2, 'Reading container');
    let format;
    try {
      format = await input.getFormat();
    } catch {
      throwIfAborted(signal);
      throw unsupportedContainerError();
    }
    throwIfAborted(signal);

    onProgress?.(0.35, 'Finding tracks');
    let videoTracks;
    let audioTracks;
    try {
      videoTracks = await input.getVideoTracks();
      audioTracks = await input.getAudioTracks();
    } catch {
      throwIfAborted(signal);
      throw new ToolError(
        'This video file could not be read — it may be truncated or corrupt.',
        'Re-export the file and try again.',
      );
    }
    if (videoTracks.length === 0) {
      throw new ToolError(
        'This file has no video track.',
        'It looks like audio-only or containerless data. The audio tools can inspect it instead.',
      );
    }
    throwIfAborted(signal);

    onProgress?.(0.5, 'Computing duration');
    const duration = await readDuration(input, signal);
    throwIfAborted(signal);

    onProgress?.(0.6, 'Inspecting tracks');
    const total = videoTracks.length + audioTracks.length;
    let done = 0;
    const step = (message: string) => {
      done += 1;
      onProgress?.(0.6 + 0.35 * (done / total), message);
    };

    const videos: VideoTrackInfo[] = [];
    for (const track of videoTracks) {
      throwIfAborted(signal);
      videos.push(
        await inspectVideoTrack(track, videos.length, { scanFrames, checkDecode, signal }),
      );
      step('Inspecting video tracks');
    }

    const audios: AudioTrackInfo[] = [];
    for (const track of audioTracks) {
      throwIfAborted(signal);
      audios.push(await inspectAudioTrack(track, audios.length, { checkDecode }));
      step('Inspecting audio tracks');
    }
    throwIfAborted(signal);

    let tags: VideoTags | null = null;
    if (readTags) {
      tags = await readMetadataTags(input);
    }

    let mimeType = '';
    try {
      mimeType = await input.getMimeType();
    } catch {
      mimeType = format.mimeType;
    }

    onProgress?.(1, 'Done');
    return {
      fileName: file.name || 'video',
      fileSize: file.size,
      format: format.name,
      formatMime: format.mimeType,
      mimeType: mimeType || format.mimeType,
      durationSeconds: duration.seconds,
      durationFromMetadata: duration.fromMetadata,
      videoTracks: videos,
      audioTracks: audios,
      tags,
      webCodecs: isWebCodecsAvailable(),
    };
  } finally {
    // Free the lazily-held references; large files otherwise pin memory.
    try {
      input.dispose();
    } catch {
      /* disposing is best-effort */
    }
  }
}

/** Open a file for decode/export work. The caller owns `dispose()`. */
export interface OpenedVideo {
  input: InstanceType<VideoEngine['Input']>;
  formatName: string;
  durationSeconds: number | null;
  videoTrack: InstanceType<VideoEngine['InputVideoTrack']> | null;
  audioTrack: InstanceType<VideoEngine['InputAudioTrack']> | null;
  dispose(): void;
}

/**
 * Foundation for the decode/export tools that follow: hands back a live Input
 * plus its primary tracks. Kept deliberately small — the tools decide what to
 * do with the samples. The caller owns `dispose()`.
 */
export async function openVideo(file: File, options: VideoProbeOptions = {}): Promise<OpenedVideo> {
  assertVideoFile(file, options.maxBytes);
  const engine = await loadVideoEngine();
  return openVideoWith(engine, file, options);
}

/** {@link openVideo} with the engine injected, for tests and custom hosts. */
export async function openVideoWith(
  engine: VideoEngine,
  file: File,
  options: VideoProbeOptions = {},
): Promise<OpenedVideo> {
  assertVideoFile(file, options.maxBytes);
  throwIfAborted(options.signal);
  const input = new engine.Input({
    formats: engine.ALL_FORMATS,
    source: new engine.BlobSource(file),
  });
  try {
    const format = await input.getFormat();
    const duration = await readDuration(input, options.signal);
    const videoTrack = await input.getPrimaryVideoTrack();
    const audioTrack = await input.getPrimaryAudioTrack();
    return {
      input,
      formatName: format.name,
      durationSeconds: duration.seconds,
      videoTrack,
      audioTrack,
      dispose: () => input.dispose(),
    };
  } catch (error) {
    input.dispose();
    throwIfAborted(options.signal);
    if (error instanceof ToolError) throw error;
    throw unsupportedContainerError();
  }
}

/* -------------------------------------------------------------------------- */
/*  Internal read helpers                                                     */
/* -------------------------------------------------------------------------- */

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('The operation was cancelled.', 'AbortError');
}

function unsupportedContainerError(): ToolError {
  return new ToolError(
    'This file is not a video container this tool can read.',
    'Recognised containers include MP4, QuickTime (MOV), WebM, Matroska (MKV), MPEG-TS, Ogg and WAV.',
  );
}

/** Try a value that may legitimately be absent; never let it doom the probe. */
async function optional<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

function normalizeLanguage(value: string | null | undefined): string | null {
  if (!value || value === 'und' || value === 'unknown') return null;
  return value;
}

async function readDuration(
  input: InstanceType<VideoEngine['Input']>,
  signal?: AbortSignal,
): Promise<{ seconds: number | null; fromMetadata: boolean }> {
  const fromMetadata = await optional(() => input.getDurationFromMetadata(), null);
  throwIfAborted(signal);
  if (typeof fromMetadata === 'number' && Number.isFinite(fromMetadata) && fromMetadata >= 0) {
    return { seconds: fromMetadata, fromMetadata: true };
  }
  const computed = await optional(() => input.computeDuration(), null);
  throwIfAborted(signal);
  if (typeof computed === 'number' && Number.isFinite(computed) && computed > 0) {
    return { seconds: computed, fromMetadata: false };
  }
  return { seconds: null, fromMetadata: false };
}

async function inspectVideoTrack(
  track: InstanceType<VideoEngine['InputVideoTrack']>,
  index: number,
  opts: { scanFrames: boolean; checkDecode: boolean; signal?: AbortSignal },
): Promise<VideoTrackInfo> {
  const codedWidth = await track.getCodedWidth();
  const codedHeight = await track.getCodedHeight();
  const displayWidth = await optional(() => track.getDisplayWidth(), codedWidth);
  const displayHeight = await optional(() => track.getDisplayHeight(), codedHeight);
  throwIfAborted(opts.signal);

  let frameRate: number | null = null;
  if (opts.scanFrames) {
    const metrics = await optional(
      () => track.computeFrameRateMetrics({ targetPacketCount: FRAME_SCAN_PACKETS }),
      null,
    );
    const guess = metrics?.bestGuessFrameRate ?? null;
    frameRate = typeof guess === 'number' && Number.isFinite(guess) && guess > 0 ? guess : null;
  }
  throwIfAborted(opts.signal);

  return {
    index,
    codec: await optional(() => track.getCodec(), null),
    codecString: await optional(() => track.getCodecParameterString(), null),
    codedWidth,
    codedHeight,
    displayWidth,
    displayHeight,
    rotation: (await optional(() => track.getRotation(), 0)) || 0,
    frameRate,
    averageBitrate: await optional(() => track.getAverageBitrate(), null),
    decodable: opts.checkDecode ? await optional(() => track.canDecode(), false) : false,
    language: normalizeLanguage(await optional(() => track.getLanguageCode(), null)),
  };
}

async function inspectAudioTrack(
  track: InstanceType<VideoEngine['InputAudioTrack']>,
  index: number,
  opts: { checkDecode: boolean },
): Promise<AudioTrackInfo> {
  return {
    index,
    codec: await optional(() => track.getCodec(), null),
    codecString: await optional(() => track.getCodecParameterString(), null),
    channels: await optional(() => track.getNumberOfChannels(), 0),
    sampleRate: await optional(() => track.getSampleRate(), 0),
    averageBitrate: await optional(() => track.getAverageBitrate(), null),
    decodable: opts.checkDecode ? await optional(() => track.canDecode(), false) : false,
    language: normalizeLanguage(await optional(() => track.getLanguageCode(), null)),
  };
}

async function readMetadataTags(
  input: InstanceType<VideoEngine['Input']>,
): Promise<VideoTags | null> {
  const raw = await optional(() => input.getMetadataTags(), null);
  if (!raw) return null;
  const tags: VideoTags = {};
  if (raw.title) tags.title = raw.title;
  if (raw.artist) tags.artist = raw.artist;
  if (raw.album) tags.album = raw.album;
  if (raw.comment) tags.comment = raw.comment;
  if (raw.date instanceof Date && !Number.isNaN(raw.date.getTime())) {
    tags.date = raw.date.toISOString();
  }
  return Object.keys(tags).length ? tags : null;
}

/* -------------------------------------------------------------------------- */
/*  Formatting (pure)                                                         */
/* -------------------------------------------------------------------------- */

const VIDEO_CODEC_LABELS: Record<string, string> = {
  avc: 'H.264 / AVC',
  hevc: 'H.265 / HEVC',
  vp8: 'VP8',
  vp9: 'VP9',
  av1: 'AV1',
  prores: 'Apple ProRes',
};

const AUDIO_CODEC_LABELS: Record<string, string> = {
  aac: 'AAC',
  opus: 'Opus',
  mp3: 'MP3',
  vorbis: 'Vorbis',
  flac: 'FLAC',
  ac3: 'AC-3',
  eac3: 'E-AC-3',
  dts: 'DTS',
};

/** Human codec name, with the raw codec string appended when it adds detail. */
export function describeVideoCodec(codec: string | null, codecString?: string | null): string {
  if (!codec) return 'Unknown';
  const label = VIDEO_CODEC_LABELS[codec] ?? codec.toUpperCase();
  const param = codecString && codecString !== codec ? ` (${codecString})` : '';
  return `${label}${param}`;
}

/** Human audio codec name, with the raw codec string appended when it adds detail. */
export function describeAudioCodec(codec: string | null, codecString?: string | null): string {
  if (!codec) return 'Unknown';
  const label =
    AUDIO_CODEC_LABELS[codec] ??
    (codec.startsWith('pcm-') ? `PCM ${codec.slice(4).toUpperCase()}` : codec.toUpperCase());
  const param = codecString && codecString !== codec ? ` (${codecString})` : '';
  return `${label}${param}`;
}

/**
 * `h:mm:ss.mmm` (or `m:ss.mmm` under an hour). Returns an em dash for values the
 * container did not expose, so callers can render it verbatim.
 */
export function formatTimecode(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—';
  const totalMs = Math.round(seconds * 1000);
  const ms = totalMs % 1000;
  const totalSeconds = (totalMs - ms) / 1000;
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  const base = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  return `${base}.${pad(ms, 3)}`;
}

/** Frame rate with two decimals only when it is not a whole number. */
export function formatFrameRate(fps: number | null | undefined): string {
  if (fps == null || !Number.isFinite(fps) || fps <= 0) return '—';
  const rounded = Math.round(fps * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)} fps`;
}

/** Bitrate in the most readable unit. */
export function formatBitrate(bps: number | null | undefined): string {
  if (bps == null || !Number.isFinite(bps) || bps <= 0) return '—';
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
  if (bps >= 1_000) return `${Math.round(bps / 1_000)} kbps`;
  return `${Math.round(bps)} bps`;
}

/** `1920 × 1080`, with coded dimensions and rotation appended when they differ. */
export function formatResolution(track: VideoTrackInfo): string {
  const display = `${track.displayWidth} × ${track.displayHeight}`;
  const extras: string[] = [];
  if (track.codedWidth !== track.displayWidth || track.codedHeight !== track.displayHeight) {
    extras.push(`coded ${track.codedWidth} × ${track.codedHeight}`);
  }
  if (track.rotation) extras.push(`rotated ${track.rotation}°`);
  return extras.length ? `${display} (${extras.join(', ')})` : display;
}

/* -------------------------------------------------------------------------- */
/*  Report builder (pure)                                                     */
/* -------------------------------------------------------------------------- */

export interface ProbeReport {
  headers: string[];
  rows: string[][];
}

/** Turn a probe into the `render: 'table'` payload the workbench renders. */
export function buildVideoProbeReport(probe: VideoProbe): ProbeReport {
  const rows: string[][] = [
    ['File name', probe.fileName],
    [
      'File size',
      `${formatBytes(probe.fileSize)} (${probe.fileSize.toLocaleString('en-US')} bytes)`,
    ],
    ['Container', `${probe.format} (${probe.formatMime})`],
    [
      'Duration',
      probe.durationSeconds == null ? 'Not available' : formatTimecode(probe.durationSeconds),
    ],
    [
      'Duration source',
      probe.durationSeconds == null
        ? '—'
        : probe.durationFromMetadata
          ? 'Container metadata'
          : 'Packet scan',
    ],
    ['WebCodecs decoding', probe.webCodecs ? 'Available' : 'Not available in this browser'],
    ['Video tracks', String(probe.videoTracks.length)],
    ['Audio tracks', String(probe.audioTracks.length)],
  ];

  if (probe.tags) {
    if (probe.tags.title) rows.push(['Title', probe.tags.title]);
    if (probe.tags.artist) rows.push(['Artist', probe.tags.artist]);
    if (probe.tags.album) rows.push(['Album', probe.tags.album]);
    if (probe.tags.date) rows.push(['Date', probe.tags.date]);
    if (probe.tags.comment) rows.push(['Comment', probe.tags.comment]);
  }

  probe.videoTracks.forEach((track, i) => {
    const label = `Video track ${i + 1}`;
    rows.push([`${label} · Codec`, describeVideoCodec(track.codec, track.codecString)]);
    rows.push([`${label} · Resolution`, formatResolution(track)]);
    rows.push([
      `${label} · Frame rate`,
      track.frameRate == null
        ? 'Not measured (turn on "Estimate frame rate")'
        : formatFrameRate(track.frameRate),
    ]);
    rows.push([`${label} · Bitrate`, formatBitrate(track.averageBitrate)]);
    rows.push([`${label} · Decodable here`, track.decodable ? 'Yes' : 'No']);
    if (track.language) rows.push([`${label} · Language`, track.language]);
  });

  probe.audioTracks.forEach((track, i) => {
    const label = `Audio track ${i + 1}`;
    rows.push([`${label} · Codec`, describeAudioCodec(track.codec, track.codecString)]);
    rows.push([`${label} · Channels`, track.channels > 0 ? String(track.channels) : 'Unknown']);
    rows.push([
      `${label} · Sample rate`,
      track.sampleRate > 0 ? `${track.sampleRate.toLocaleString('en-US')} Hz` : 'Unknown',
    ]);
    rows.push([`${label} · Bitrate`, formatBitrate(track.averageBitrate)]);
    rows.push([`${label} · Decodable here`, track.decodable ? 'Yes' : 'No']);
    if (track.language) rows.push([`${label} · Language`, track.language]);
  });

  return { headers: ['Property', 'Value'], rows };
}
