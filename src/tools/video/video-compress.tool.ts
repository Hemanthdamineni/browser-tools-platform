/**
 * Video compressor.
 *
 * The clip is demuxed, decoded, re-encoded and muxed by the shared
 * Mediabunny-based engine (`@/lib/video`), which is loaded lazily on the first
 * run — it is ~180 KB gzipped and must never end up in the main bundle. File
 * tools run inside the generic tool worker, so a long re-encode never freezes
 * the page: progress is streamed back and the run can be cancelled.
 *
 * Nothing leaves the device. The output is a genuinely re-encoded file: the
 * frames are decoded and pushed through the browser's video encoder, the audio
 * is re-encoded as well, and the result is muxed into a fresh MP4 or WebM
 * container. The finished file is read back with the engine before it is
 * handed over, so a broken file is never offered as a download.
 *
 * The pure parts — the presets, the bitrate maths, the memory warnings and the
 * output file name — live in `./compress` so they can be unit-tested without a
 * browser codec.
 */

import type { FileRunInput, FileRunResult, FileToolModule } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { formatBytes } from '@/lib/format';
import {
  assertDecodeBudget,
  assertVideoFile,
  chooseVideoEncoder,
  describeVideoCodec,
  formatBitrate,
  formatTimecode,
  loadVideoEngine,
  probeVideoFile,
  probeVideoFileWith,
  type VideoEngine,
  type VideoProbe,
} from '@/lib/video';
import {
  compressOutputFilename,
  formatSizeChange,
  resolveCompressSettings,
  sizeChangePercent,
  CONTAINER_AUDIO_CODECS,
  CONTAINER_LABELS,
  CONTAINER_MIME_TYPES,
  CONTAINER_VIDEO_CODECS,
  COMPRESS_MAX_SOURCE_BYTES,
  type CompressContainer,
  type CompressSettings,
  type CompressSourceInfo,
} from './compress';
import { meta } from './video-compress.meta';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface CompressRunContext {
  signal?: AbortSignal;
  onProgress?: (fraction: number, message?: string) => void;
}

/** A video codec the engine knows about. */
type VideoCodecName = VideoEngine['VIDEO_CODECS'][number];
/** An audio codec the engine knows about. */
type AudioCodecName = VideoEngine['AUDIO_CODECS'][number];

/** What the encoder produced. */
export interface EncodedVideo {
  /** The encoded file. */
  bytes: Uint8Array;
  /** MIME type of the encoded file. */
  mimeType: string;
  /** The video codec that was used. */
  codec: string;
  /** The audio codec that was used, or `null` when the audio was dropped. */
  audioCodec: string | null;
  /** A probe of the produced file — proof that it is a readable container. */
  probe: VideoProbe;
  /** Warnings raised while encoding. */
  warnings: string[];
}

/** The seams the tests use to drive the tool without a browser codec. */
export interface CompressDeps {
  /** Reads the source container. */
  probe?: (file: File, ctx: CompressRunContext) => Promise<VideoProbe>;
  /** Re-encodes the clip. */
  encode?: (
    file: File,
    settings: CompressSettings,
    source: CompressSourceInfo,
    ctx: CompressRunContext,
  ) => Promise<EncodedVideo>;
}

/* -------------------------------------------------------------------------- */
/*  Capabilities                                                               */
/* -------------------------------------------------------------------------- */

/**
 * WebCodecs is what does the actual work: the decoder turns the source frames
 * into pictures and the encoder turns them back into a compressed video. A
 * browser without it cannot compress anything, and saying so plainly is much
 * better than failing somewhere deep inside the encoder.
 */
function assertWebCodecsAvailable(): void {
  const scope = globalThis as unknown as { VideoDecoder?: unknown; VideoEncoder?: unknown };
  if (typeof scope.VideoDecoder !== 'function') {
    throw new ToolError(
      'This browser cannot decode video — WebCodecs is not available.',
      'Try a recent Chrome, Edge or Firefox. The Video File Info tool can still read the container.',
    );
  }
  if (typeof scope.VideoEncoder !== 'function') {
    throw new ToolError(
      'This browser cannot encode video — WebCodecs is not available.',
      'Try a recent Chrome, Edge or Firefox; they can re-encode H.264 or VP9 in the browser.',
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  Probing                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Read the source container.
 *
 * The engine can be injected, which is how the tests exercise every branch
 * (no video track, undecodable codec, missing duration) without a real
 * browser codec.
 */
export async function probeCompressSource(
  file: File,
  ctx: CompressRunContext,
  engine?: VideoEngine,
): Promise<VideoProbe> {
  const options = {
    signal: ctx.signal,
    // The frame rate decides the bitrate maths, so it is worth the packet scan.
    scanFrames: true,
    readTags: false,
    checkDecode: true,
    maxBytes: COMPRESS_MAX_SOURCE_BYTES,
    onProgress: (fraction: number, message?: string) => ctx.onProgress?.(fraction * 0.15, message),
  };
  return engine ? probeVideoFileWith(engine, file, options) : probeVideoFile(file, options);
}

/** Turn a probe into the numbers the bitrate maths needs. */
export function sourceInfoFromProbe(probe: VideoProbe): CompressSourceInfo {
  const track = probe.videoTracks[0];
  const audio = probe.audioTracks[0] ?? null;
  if (!track) {
    throw new ToolError(
      'This file has no video track.',
      'It looks like audio-only data — the audio tools can inspect it instead.',
    );
  }
  return {
    fileSize: probe.fileSize,
    durationSeconds: probe.durationSeconds,
    width: track.displayWidth,
    height: track.displayHeight,
    frameRate: track.frameRate,
    videoBitrate: track.averageBitrate,
    audioBitrate: audio?.averageBitrate ?? null,
    audioChannels: audio?.channels ?? null,
    audioSampleRate: audio?.sampleRate ?? null,
    hasAudio: probe.audioTracks.length > 0,
  };
}

/* -------------------------------------------------------------------------- */
/*  Codec selection                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Pick a video codec this browser can encode *and* the container can hold.
 *
 * This is the container-aware version of the shared `chooseVideoEncoder`
 * helper: that helper falls back to "any codec the browser can encode", but a
 * codec the container cannot hold (H.264 in a WebM file, say) would produce a
 * file without a picture — so the fallback is made here, against the
 * container's own list.
 *
 * The engine can be injected, which is how the tests drive this without a
 * browser codec.
 */
export async function pickVideoCodec(
  container: CompressContainer,
  options: { width: number; height: number; frameRate?: number },
  engine?: VideoEngine,
): Promise<VideoCodecName | null> {
  const resolved = engine ?? (await loadVideoEngine());
  const format =
    container === 'webm' ? new resolved.WebMOutputFormat() : new resolved.Mp4OutputFormat();
  const supported = format.getSupportedVideoCodecs();
  const preferred = CONTAINER_VIDEO_CODECS[container].filter((codec) =>
    supported.includes(codec as VideoCodecName),
  );

  let first: string | null = null;
  if (engine) {
    const wanted = preferred.filter((codec) =>
      (resolved.VIDEO_CODECS as readonly string[]).includes(codec),
    ) as VideoCodecName[];
    first = await resolved.getFirstEncodableVideoCodec(wanted, options);
  } else {
    // The shared helper: the first of the preferred codecs this browser can encode.
    first = await chooseVideoEncoder(preferred, options);
  }
  if (first && supported.includes(first as VideoCodecName)) return first as VideoCodecName;

  const any = await resolved.getEncodableVideoCodecs(undefined, options);
  return (any.find((codec) => supported.includes(codec)) ?? null) as VideoCodecName | null;
}

/** Pick an audio codec this browser can encode and the container can hold. */
export async function pickAudioCodec(
  container: CompressContainer,
  options: { numberOfChannels?: number; sampleRate?: number },
  engine?: VideoEngine,
): Promise<AudioCodecName | null> {
  const resolved = engine ?? (await loadVideoEngine());
  const format =
    container === 'webm' ? new resolved.WebMOutputFormat() : new resolved.Mp4OutputFormat();
  const supported = format.getSupportedAudioCodecs();
  const preferred = CONTAINER_AUDIO_CODECS[container].filter((codec) =>
    supported.includes(codec as AudioCodecName),
  );
  const wanted = preferred.filter((codec) =>
    (resolved.AUDIO_CODECS as readonly string[]).includes(codec),
  ) as AudioCodecName[];
  if (!wanted.length) return null;
  const first = await resolved.getFirstEncodableAudioCodec(wanted, options);
  if (first && supported.includes(first)) return first;
  const any = await resolved.getEncodableAudioCodecs(undefined, options);
  return (any.find((codec) => supported.includes(codec)) ?? null) as AudioCodecName | null;
}

/* -------------------------------------------------------------------------- */
/*  Encoding                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Re-encode the clip with the shared video engine.
 *
 * The frames are decoded from the source, scaled to the requested width and
 * pushed through the browser's encoder; the audio is re-encoded too, so the
 * result is a fresh file rather than a copy of the input. The produced bytes
 * are read back with the engine before they are returned — a file that cannot
 * be parsed is never handed to the user.
 */
export async function encodeCompressedVideo(
  file: File,
  settings: CompressSettings,
  source: CompressSourceInfo,
  ctx: CompressRunContext,
  engine?: VideoEngine,
): Promise<EncodedVideo> {
  ctx.signal?.throwIfAborted?.();
  assertWebCodecsAvailable();
  const resolved = engine ?? (await loadVideoEngine());
  ctx.onProgress?.(0.16, 'Choosing an encoder');

  const codec = await pickVideoCodec(
    settings.container,
    {
      width: settings.width,
      height: settings.height,
      ...(settings.frameRate ? { frameRate: settings.frameRate } : {}),
    },
    engine,
  );
  if (!codec) {
    throw new ToolError(
      'This browser cannot encode any video format this tool supports.',
      'Try a recent Chrome, Edge or Firefox — the tool needs WebCodecs to re-encode the clip.',
    );
  }

  const warnings: string[] = [];
  let audioCodec: AudioCodecName | null = null;
  if (settings.keepAudio) {
    audioCodec = await pickAudioCodec(
      settings.container,
      {
        ...(source.audioChannels ? { numberOfChannels: source.audioChannels } : {}),
        ...(source.audioSampleRate ? { sampleRate: source.audioSampleRate } : {}),
      },
      engine,
    );
    if (!audioCodec) {
      warnings.push(
        'This browser cannot encode audio, so the sound track was dropped from the compressed file.',
      );
    }
  }

  ctx.onProgress?.(0.18, 'Preparing the encoder');
  const format =
    settings.container === 'webm'
      ? new resolved.WebMOutputFormat()
      : new resolved.Mp4OutputFormat();
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
      video: {
        codec,
        quality: new resolved.Quality({ bitrate: Math.round(settings.videoBitrate) }),
        width: settings.width,
        ...(settings.frameRate ? { frameRate: settings.frameRate } : {}),
        // Force a real re-encode: the source packets are never copied over.
        forceTranscode: true,
        keyFrameInterval: 2,
      },
      audio: audioCodec
        ? {
            codec: audioCodec,
            quality: new resolved.Quality({ bitrate: Math.round(settings.audioBitrate) }),
            forceTranscode: true,
          }
        : { discard: true },
      // Never copy the encoded packets: the whole point is to re-encode.
      copy: false,
      // Only the main video and audio tracks are re-encoded; a second picture
      // track would only make the run slower.
      tracks: 'primary',
      showWarnings: false,
    });
  } catch (error) {
    disposeInput(input);
    if (error instanceof ToolError) throw error;
    throw new ToolError(
      'This video could not be prepared for re-encoding.',
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
        'Re-export the clip as H.264 (MP4) or VP8/VP9 (WebM) and try again.',
      );
    }
    if (reason === 'no_encodable_target_codec') {
      throw new ToolError(
        'This browser cannot encode the video format this tool needs.',
        'Try a recent Chrome, Edge or Firefox, or pick the other container.',
      );
    }
    throw new ToolError(
      'This video could not be prepared for re-encoding.',
      'The file may be damaged, or it may use features this browser does not support.',
    );
  }
  for (const track of discarded) {
    if (track.type === 'audio') {
      warnings.push('The audio track could not be re-encoded and was left out of the file.');
    }
  }

  conversion.onProgress = (progress: number) => {
    const fraction = Math.min(1, Math.max(0, progress));
    ctx.onProgress?.(0.2 + 0.75 * fraction, 'Re-encoding');
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
      'This video could not be re-encoded.',
      'The file may be damaged, or the browser ran out of memory. Try a shorter clip or a smaller width.',
    );
  } finally {
    ctx.signal?.removeEventListener('abort', onAbort);
    disposeInput(input);
  }

  const buffer = target.buffer;
  if (!buffer || buffer.byteLength === 0) {
    throw new ToolError(
      'The encoder produced an empty file.',
      'Try a different preset, or a shorter clip.',
    );
  }
  const bytes = new Uint8Array(buffer);

  ctx.onProgress?.(0.97, 'Checking the result');
  const probe = await verifyEncodedOutput(bytes, settings, ctx, resolved);

  return {
    bytes,
    mimeType: await safeMimeType(output, settings.container),
    codec,
    audioCodec,
    probe,
    warnings,
  };
}

/** Read the produced file back, so a broken file is never handed over. */
async function verifyEncodedOutput(
  bytes: Uint8Array,
  settings: CompressSettings,
  ctx: CompressRunContext,
  engine: VideoEngine,
): Promise<VideoProbe> {
  const file = new File([bytes.slice().buffer as ArrayBuffer], `compressed.${settings.extension}`, {
    type: settings.container === 'webm' ? 'video/webm' : 'video/mp4',
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
      'The compressed file could not be read back, so it was discarded.',
      'The encoder produced something unusable — try another preset or a different container.',
    );
  }
}

async function safeMimeType(
  output: { getMimeType?: () => Promise<string> },
  container: CompressContainer,
): Promise<string> {
  try {
    const mime = await output.getMimeType?.();
    if (mime) return mime;
  } catch {
    /* fall through to the generic container type */
  }
  return CONTAINER_MIME_TYPES[container];
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
 * Run the compression and turn it into the workbench's result shape: the
 * compressed file as a download, an inline before/after table and the notes.
 */
export async function runVideoCompress(
  input: FileRunInput,
  deps: CompressDeps = {},
): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const { files, signal, onProgress } = input;

  if (!files.length) throw new ToolError('Choose a video file.');
  if (files.length > 1) {
    throw new ToolError(`Choose one video file — ${files.length} were selected.`);
  }
  const file = files[0]!;

  assertVideoFile(file, COMPRESS_MAX_SOURCE_BYTES);
  signal?.throwIfAborted?.();
  onProgress?.(0.02, 'Reading the video');

  const probe = await (deps.probe ?? probeCompressSource)(file, { signal, onProgress });
  const source = sourceInfoFromProbe(probe);

  // The decoder has to hold a frame of the source at a time: refuse the frames
  // that would not fit instead of wedging the tab.
  const track = probe.videoTracks[0]!;
  assertDecodeBudget(
    Math.max(track.codedWidth, track.displayWidth),
    Math.max(track.codedHeight, track.displayHeight),
  );

  onProgress?.(0.16, 'Working out the settings');
  const settings = resolveCompressSettings(o, source);

  const encoded = await (deps.encode ?? encodeCompressedVideo)(file, settings, source, {
    signal,
    onProgress,
  });

  const sourceBytes = probe.fileSize;
  const outputBytes = encoded.bytes.byteLength;
  const filename = compressOutputFilename(file.name, settings.extension);
  const blob = new Blob([encoded.bytes.slice().buffer as ArrayBuffer], {
    type: encoded.mimeType,
  });

  const warnings = [...settings.warnings, ...encoded.warnings];
  if (outputBytes >= sourceBytes) {
    warnings.push(
      'The compressed file came out the same size as (or bigger than) the original — the source was already compressed hard, so there was little to gain.',
    );
  }
  if (!settings.keepAudio && source.hasAudio) {
    warnings.push('The audio track was dropped — turn "Keep the audio" on to keep the sound.');
  }

  const outTrack = encoded.probe.videoTracks[0];
  const outWidth = outTrack?.displayWidth ?? settings.width;
  const outHeight = outTrack?.displayHeight ?? settings.height;
  const outDuration = encoded.probe.durationSeconds ?? source.durationSeconds;
  const outFps = outTrack?.frameRate ?? settings.frameRate;

  const notes = [
    `Source ${formatBytes(sourceBytes)} → compressed ${formatBytes(outputBytes)} (${formatSizeChange(sourceBytes, outputBytes)}).`,
    `Re-encoded with ${describeVideoCodec(encoded.codec)} in ${CONTAINER_LABELS[settings.container]} at ${formatBitrate(settings.videoBitrate)}.`,
    encoded.audioCodec
      ? `Audio re-encoded with ${encoded.audioCodec.toUpperCase()} at ${formatBitrate(settings.audioBitrate)}.`
      : 'No audio in the compressed file.',
    `Frame size ${outWidth} × ${outHeight}${outFps ? ` · ${outFps} fps` : ''} · ${formatTimecode(outDuration)}.`,
  ];

  const report = {
    output: JSON.stringify({
      headers: ['Property', 'Value'],
      rows: [
        [
          'Source size',
          `${formatBytes(sourceBytes)} (${sourceBytes.toLocaleString('en-US')} bytes)`,
        ],
        [
          'Compressed size',
          `${formatBytes(outputBytes)} (${outputBytes.toLocaleString('en-US')} bytes)`,
        ],
        [
          'Change',
          `${formatSizeChange(sourceBytes, outputBytes)} (${sizeChangePercent(sourceBytes, outputBytes)}%)`,
        ],
        ['Duration', formatTimecode(outDuration)],
        ['Resolution', `${outWidth} × ${outHeight}`],
        ['Frame rate', outFps ? `${outFps} fps` : '—'],
        ['Video codec', describeVideoCodec(encoded.codec)],
        ['Container', CONTAINER_LABELS[settings.container]],
        ['Video bitrate', formatBitrate(settings.videoBitrate)],
        [
          'Audio',
          encoded.audioCodec
            ? `${encoded.audioCodec.toUpperCase()} · ${formatBitrate(settings.audioBitrate)}`
            : 'Dropped',
        ],
        ['Preset', settings.presetId],
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
      savedBytes: sourceBytes - outputBytes,
      savedPercent: sizeChangePercent(sourceBytes, outputBytes),
      durationSeconds: outDuration == null ? 0 : Math.round(outDuration * 100) / 100,
      width: outWidth,
      height: outHeight,
      fps: outFps ?? 0,
      codec: encoded.codec,
      container: settings.container,
    },
  };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  return runVideoCompress(input);
}

const tool: FileToolModule = { meta, run };
export default tool;
