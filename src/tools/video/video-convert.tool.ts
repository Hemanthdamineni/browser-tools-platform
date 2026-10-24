/**
 * Video container converter.
 *
 * The heavy lifting (demuxing, decoding, re-encoding, muxing) happens in the
 * generic tool worker, so a long conversion never freezes the page. Nothing
 * leaves the device: the clip is read from the local `File` and processed with
 * the shared Mediabunny-based engine (`@/lib/video`).
 *
 * The pure parts — option validation, the container/codec compatibility
 * decision, the remux-vs-transcode plan and the bitrate maths — live in
 * `./video-convert.core` so they can be unit tested without a browser codec.
 */

import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { formatBytes } from '@/lib/format';
import {
  assertDecodeBudget,
  assertVideoFile,
  describeAudioCodec,
  describeVideoCodec,
  formatBitrate,
  formatFrameRate,
  formatTimecode,
  isWebCodecsAvailable,
  loadVideoEngine,
  probeVideoFile,
  probeVideoFileWith,
  type VideoEngine,
  type VideoProbe,
} from '@/lib/video';
import {
  checkConvertOutputSize,
  CONTAINERS,
  convertOutputFilename,
  decideConvertPlan,
  describeAudioPath,
  describeVideoPath,
  CONVERT_MAX_SOURCE_BYTES,
  resolveConvertOptions,
  type ConvertCapabilities,
  type ConvertPlan,
  type ConvertSource,
} from './video-convert.core';
import { meta } from './video-convert.meta';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface ConvertRunContext {
  signal?: AbortSignal;
  onProgress?: (fraction: number, message?: string) => void;
}

/** What the conversion produced. */
export interface ConvertedVideo {
  /** The converted file. */
  bytes: Uint8Array;
  /** MIME type of the converted file. */
  mimeType: string;
  /** The path the video stream took: `remux` (stream copy) or `transcode`. */
  videoPath: 'remux' | 'transcode';
  /** The video codec in the output. */
  videoCodec: string;
  /** The audio codec in the output, or `null` when there is no sound. */
  audioCodec: string | null;
  /** The path the audio track took. */
  audioPath: 'remux' | 'transcode' | 'drop';
  /** A probe of the produced file — proof that it is a readable container. */
  probe: VideoProbe;
}

/** The seams the tests use to drive the tool without a browser codec. */
export interface ConvertDeps {
  /** Reads the source container. */
  probe?: (file: File, ctx: ConvertRunContext) => Promise<VideoProbe>;
  /** Performs the conversion. */
  convert?: (
    file: File,
    plan: ConvertPlan,
    source: ConvertSource,
    ctx: ConvertRunContext,
  ) => Promise<ConvertedVideo>;
}

/* -------------------------------------------------------------------------- */
/*  Probing                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Read the source container.
 *
 * The engine can be injected, which is how the tests exercise every branch
 * (unsupported container, audio-only file, missing duration) without a real
 * browser codec.
 */
export async function probeConvertSource(
  file: File,
  ctx: ConvertRunContext,
  engine?: VideoEngine,
): Promise<VideoProbe> {
  const options = {
    signal: ctx.signal,
    // The frame rate matters for the encoder config, so it is worth the scan.
    scanFrames: true,
    readTags: false,
    checkDecode: true,
    maxBytes: CONVERT_MAX_SOURCE_BYTES,
    onProgress: (fraction: number, message?: string) => ctx.onProgress?.(fraction * 0.15, message),
  };
  return engine ? probeVideoFileWith(engine, file, options) : probeVideoFile(file, options);
}

/** Turn a probe into the description the conversion plan is built from. */
export function convertSourceFromProbe(probe: VideoProbe): ConvertSource {
  const track = probe.videoTracks[0];
  if (!track) {
    throw new ToolError(
      'This file has no video track.',
      'It looks like audio-only data — the audio tools can inspect it instead.',
    );
  }
  const audio = probe.audioTracks[0] ?? null;
  return {
    fileSize: probe.fileSize,
    formatName: probe.format,
    durationSeconds: probe.durationSeconds,
    width: track.displayWidth,
    height: track.displayHeight,
    frameRate: track.frameRate,
    videoCodec: track.codec,
    videoCodecLabel: describeVideoCodec(track.codec, track.codecString),
    videoDecodable: track.decodable,
    videoBitrate: track.averageBitrate,
    hasAudio: probe.audioTracks.length > 0,
    audioCodec: audio?.codec ?? null,
    audioDecodable: audio?.decodable ?? false,
    audioChannels: audio?.channels ?? null,
    audioSampleRate: audio?.sampleRate ?? null,
  };
}

/** Ask the shared engine what this browser can encode. */
export async function convertCapabilities(
  engine?: VideoEngine,
): Promise<ConvertCapabilities> {
  if (!isWebCodecsAvailable()) return { webCodecs: false, encodableVideo: [], encodableAudio: [] };
  const resolved = engine ?? (await loadVideoEngine());
  const [video, audio] = await Promise.all([
    resolved.getEncodableVideoCodecs(),
    resolved.getEncodableAudioCodecs(),
  ]);
  return { webCodecs: true, encodableVideo: video, encodableAudio: audio };
}

/* -------------------------------------------------------------------------- */
/*  Conversion                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Convert the clip with the shared video engine.
 *
 * The plan decides per track whether the encoded packets are copied over
 * (remux) or decoded and re-encoded (transcode). The produced bytes are read
 * back with the engine before they are returned — a file that cannot be
 * parsed is never handed to the user.
 */
export async function convertVideo(
  file: File,
  plan: ConvertPlan,
  source: ConvertSource,
  ctx: ConvertRunContext,
  engine?: VideoEngine,
): Promise<ConvertedVideo> {
  ctx.signal?.throwIfAborted?.();
  const resolved = engine ?? (await loadVideoEngine());
  const spec = CONTAINERS[plan.container];

  const format = createOutputFormat(resolved, plan.container);
  const target = new resolved.BufferTarget();
  const output = new resolved.Output({ format, target });
  const input = new resolved.Input({
    formats: resolved.ALL_FORMATS,
    source: new resolved.BlobSource(file),
  });

  let conversion;
  try {
    conversion = await resolved.Conversion.init({
      input,
      output,
      video:
        plan.video.path === 'drop'
          ? { discard: true }
          : plan.video.path === 'remux'
            ? {}
            : {
                codec: plan.video.codec as never,
                quality: new resolved.Quality({ bitrate: plan.bitrate! }),
                ...(source.frameRate ? { frameRate: source.frameRate } : {}),
              },
      audio:
        plan.audio.path === 'drop'
          ? { discard: true }
          : plan.audio.path === 'remux'
            ? {}
            : {
                codec: plan.audio.codec as never,
                quality: new resolved.Quality({ bitrate: 128_000 }),
                ...(source.audioChannels ? { numberOfChannels: source.audioChannels } : {}),
                ...(source.audioSampleRate ? { sampleRate: source.audioSampleRate } : {}),
              },
      tracks: 'primary',
      showWarnings: false,
    });
  } catch (error) {
    disposeInput(input);
    if (error instanceof ToolError) throw error;
    throw new ToolError(
      'This video could not be prepared for conversion.',
      'The file may use a codec or a container this browser cannot handle.',
    );
  }

  const discarded = conversion.discardedTracks.map((track) => ({
    type: track.track.type,
    reason: track.reason,
  }));
  if (!conversion.isValid || discarded.some((track) => track.type === 'video')) {
    disposeInput(input);
    const reason = discarded.find((track) => track.type === 'video')?.reason;
    if (reason === 'undecodable_source_codec') {
      throw new ToolError(
        'This browser cannot decode the video codec used in this file.',
        `Re-export the clip as H.264 (MP4) or VP9 (WebM) and convert again — or pick MKV, which holds almost every codec.`,
      );
    }
    if (reason === 'no_encodable_target_codec') {
      throw new ToolError(
        `This browser cannot encode the video format ${spec.label} needs.`,
        'Try a recent Chrome, Edge or Firefox, or pick another target container.',
      );
    }
    throw new ToolError(
      'This video could not be prepared for conversion.',
      'The file may be damaged, or it may use features this browser does not support.',
    );
  }
  for (const track of discarded) {
    // A track the user chose to drop is not a failure — that is the plan.
    if (track.type === 'audio' && track.reason !== 'discarded_by_user') {
      throw new ToolError(
        'The audio track could not be placed in the converted file.',
        'Turn “Keep the audio” off and run the conversion again.',
      );
    }
  }

  conversion.onProgress = (progress: number) => {
    const fraction = Math.min(1, Math.max(0, progress));
    ctx.onProgress?.(0.2 + 0.75 * fraction, 'Converting');
  };

  const onAbort = (): void => {
    void conversion.cancel();
  };
  ctx.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    await conversion.execute();
  } catch (error) {
    if (ctx.signal?.aborted) {
      throw new DOMException('The operation was cancelled.', 'AbortError');
    }
    if (error instanceof ToolError) throw error;
    throw new ToolError(
      'This video could not be converted.',
      'The file may be damaged, or the browser ran out of memory. Try a shorter clip.',
    );
  } finally {
    ctx.signal?.removeEventListener('abort', onAbort);
    disposeInput(input);
  }

  const buffer = target.buffer;
  if (!buffer || buffer.byteLength === 0) {
    throw new ToolError(
      'The converter produced an empty file.',
      'Try a different target container, or a shorter clip.',
    );
  }
  const bytes = new Uint8Array(buffer);

  ctx.onProgress?.(0.97, 'Checking the result');
  const probe = await verifyConvertedOutput(bytes, plan, ctx, resolved);

  // Report the codecs the output actually carries, straight from the muxed
  // file — a stream copy keeps the source codec, a re-encode the new one.
  const outVideo = probe.videoTracks[0];
  const outAudio = probe.audioTracks[0] ?? null;
  const videoPath = plan.video.path === 'remux' ? 'remux' : 'transcode';
  const audioPath = plan.audio.path === 'drop' ? 'drop' : plan.audio.path;
  if (videoPath === 'transcode' && outVideo?.codec && plan.video.codec) {
    if (outVideo.codec !== plan.video.codec) {
      throw new ToolError(
        `The converted file carries ${describeVideoCodec(outVideo.codec)} where ${describeVideoCodec(plan.video.codec)} was requested.`,
        'The encoder fell back silently — this is a bug. Try “Auto” instead of the explicit codec.',
      );
    }
  }

  return {
    bytes,
    mimeType: await safeMimeType(output, plan.container),
    videoPath,
    videoCodec: outVideo?.codec ?? plan.video.codec ?? '',
    audioCodec: outAudio?.codec ?? null,
    audioPath,
    probe,
  };
}

/** Build the output format object for a container id. */
function createOutputFormat(
  engine: VideoEngine,
  container: ConvertPlan['container'],
): InstanceType<VideoEngine['OutputFormat']> {
  switch (container) {
    case 'webm':
      return new engine.WebMOutputFormat();
    case 'mov':
      return new engine.MovOutputFormat();
    case 'mkv':
      return new engine.MkvOutputFormat();
    case 'mp4':
    default:
      return new engine.Mp4OutputFormat();
  }
}

/** Read the produced file back, so a broken file is never handed over. */
async function verifyConvertedOutput(
  bytes: Uint8Array,
  plan: ConvertPlan,
  ctx: ConvertRunContext,
  engine: VideoEngine,
): Promise<VideoProbe> {
  const spec = CONTAINERS[plan.container];
  const file = new File([bytes.slice().buffer as ArrayBuffer], `converted.${spec.extension}`, {
    type: spec.mimeType,
  });
  try {
    const probe = await probeVideoFileWith(engine, file, {
      signal: ctx.signal,
      scanFrames: false,
      readTags: false,
      checkDecode: false,
    });
    if (!probe.videoTracks.length) {
      throw new Error('no video track');
    }
    return probe;
  } catch (error) {
    if (ctx.signal?.aborted) {
      throw new DOMException('The operation was cancelled.', 'AbortError');
    }
    throw new ToolError(
      'The converted file could not be read back, so it was discarded.',
      'The converter produced something unusable — try another target container.',
    );
  }
}

async function safeMimeType(
  output: { getMimeType?: () => Promise<string> },
  container: ConvertPlan['container'],
): Promise<string> {
  try {
    const mime = await output.getMimeType?.();
    if (mime) return mime;
  } catch {
    /* fall through to the generic container type */
  }
  return CONTAINERS[container].mimeType;
}

function disposeInput(input: { dispose?: () => void }): void {
  try {
    input.dispose?.();
  } catch {
    /* disposing is best-effort */
  }
}

/* -------------------------------------------------------------------------- */
/*  Tool                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Run the conversion and turn it into the workbench's result shape: the
 * converted file as a download, an inline table describing what happened, and
 * the notes — including a clear statement of whether the file was remuxed or
 * re-encoded.
 */
export async function runVideoConvert(
  input: FileRunInput,
  deps: ConvertDeps = {},
): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const { files, signal, onProgress } = input;

  if (!files.length) throw new ToolError('Choose a video file.');
  if (files.length > 1) {
    throw new ToolError(`Choose one video file — ${files.length} were selected.`);
  }
  const file = files[0]!;

  assertVideoFile(file, CONVERT_MAX_SOURCE_BYTES);
  signal?.throwIfAborted?.();
  onProgress?.(0.02, 'Reading the video');

  const prefs = resolveConvertOptions(o);
  const probe = await (deps.probe ?? probeConvertSource)(file, { signal, onProgress });
  const source = convertSourceFromProbe(probe);

  // The decoder has to hold a frame of the source at a time when it
  // re-encodes; refuse the frames that would not fit instead of wedging the tab.
  const track = probe.videoTracks[0]!;
  assertDecodeBudget(
    Math.max(track.codedWidth, track.displayWidth),
    Math.max(track.codedHeight, track.displayHeight),
  );

  onProgress?.(0.16, 'Planning the conversion');
  const capabilities = await convertCapabilities();
  const plan = decideConvertPlan(source, prefs, capabilities);
  const sizeWarnings = checkConvertOutputSize(source, plan);

  const converted = await (deps.convert ?? convertVideo)(file, plan, source, {
    signal,
    onProgress,
  });

  const sourceBytes = source.fileSize;
  const outputBytes = converted.bytes.byteLength;
  const filename = convertOutputFilename(file.name, plan.extension);
  const blob = new Blob([converted.bytes.slice().buffer as ArrayBuffer], {
    type: converted.mimeType,
  });

  const warnings = [...plan.warnings, ...sizeWarnings];

  const outTrack = converted.probe.videoTracks[0];
  const outWidth = outTrack?.displayWidth ?? source.width;
  const outHeight = outTrack?.displayHeight ?? source.height;
  const outDuration = converted.probe.durationSeconds ?? source.durationSeconds;
  const outFps = outTrack?.frameRate ?? source.frameRate;

  const notes = [
    `Video: ${describeVideoPath(plan)}.`,
    converted.audioPath === 'drop'
      ? 'Audio: none in the converted file.'
      : `Audio: ${describeAudioPath(plan)}.`,
    `Source ${formatBytes(sourceBytes)} → converted ${formatBytes(outputBytes)} (${outputBytes >= sourceBytes ? 'larger' : 'smaller'} — a ${plan.video.path === 'remux' ? 'remux copies the original data' : 're-encode balances quality against size'}).`,
    `Container ${CONTAINERS[plan.container].label} · ${outWidth} × ${outHeight}${outFps ? ` · ${formatFrameRate(outFps)}` : ''} · ${formatTimecode(outDuration)}.`,
  ];

  const report = {
    output: JSON.stringify({
      headers: ['Property', 'Value'],
      rows: [
        ['Source container', source.formatName],
        ['Target container', CONTAINERS[plan.container].label],
        ['Conversion', plan.video.path === 'remux' ? 'Remux (stream copy)' : 'Transcode (re-encode)'],
        ['Video codec', describeVideoCodec(converted.videoCodec)],
        ['Video bitrate', plan.video.path === 'remux' ? 'copied from the source' : formatBitrate(plan.bitrate)],
        [
          'Audio',
          converted.audioPath === 'drop'
            ? 'Dropped'
            : `${describeAudioCodec(converted.audioCodec)} · ${
                converted.audioPath === 'remux' ? 'copied' : 're-encoded'
              }`,
        ],
        ['Source size', `${formatBytes(sourceBytes)} (${sourceBytes.toLocaleString('en-US')} bytes)`],
        ['Result size', `${formatBytes(outputBytes)} (${outputBytes.toLocaleString('en-US')} bytes)`],
        ['Duration', formatTimecode(outDuration)],
        ['Resolution', `${outWidth} × ${outHeight}`],
      ],
    }),
    render: 'table' as const,
  };

  return {
    outputs: [{ filename, blob }],
    report,
    notes,
    warnings: warnings.length ? warnings : undefined,
    stats: {
      sourceBytes,
      outputBytes,
      videoPath: converted.videoPath,
      videoCodec: converted.videoCodec,
      audioPath: converted.audioPath,
      audioCodec: converted.audioCodec ?? '',
      container: plan.container,
      durationSeconds: outDuration == null ? 0 : Math.round(outDuration * 100) / 100,
      width: outWidth,
      height: outHeight,
    },
  };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  return runVideoConvert(input);
}

const tool: FileToolModule = { meta, run };
export default tool;
