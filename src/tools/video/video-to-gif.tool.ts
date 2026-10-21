/**
 * Video → animated GIF.
 *
 * The heavy lifting (demuxing, decoding, quantising, GIF encoding) happens in
 * the tool worker, so the page never freezes. Nothing leaves the device: the
 * clip is read from the local `File`, decoded with the shared Mediabunny-based
 * engine (`@/lib/video`) and encoded with `gifenc` (MIT).
 *
 * The pure parts — option validation, the frame plan, the palette quantiser,
 * the dither and the frame selection — live in `./gif` so they can be unit
 * tested without a browser codec.
 */

import type { FileRunInput, FileRunResult, FileToolModule, OptionValues } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import {
  assertDecodeBudget,
  formatTimecode,
  isWebCodecsAvailable,
  loadVideoEngine,
  openVideo,
  openVideoWith,
  type VideoEngine,
} from '@/lib/video';
import {
  createGifWriter,
  estimateGifBytes,
  gifDataUrl,
  gifOutputFilename,
  loadGifEncoder,
  planFrameTimestamps,
  resolveGifSettings,
  selectFrames,
  GIF_MAX_OUTPUT_BYTES,
  GIF_MAX_PREVIEW_BYTES,
  GIF_MAX_THUMBNAIL_BYTES,
  type PaletteScope,
} from './gif';
import { meta } from './video-to-gif.meta';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface GifRunContext {
  signal?: AbortSignal;
  onProgress?: (fraction: number, message?: string) => void;
}

/** One decoded frame, already scaled to the output size. */
export interface GifFrame {
  /** Presentation timestamp in seconds. */
  timestamp: number;
  /** RGBA pixels, `width * height * 4` bytes. */
  rgba: Uint8ClampedArray;
}

/** What the converter needs to know before it can decode anything. */
export interface GifFrameRequest {
  width: number;
  height: number;
  startSeconds: number;
  endSeconds: number;
}

/** A decoded video, ready to be sampled. */
export interface GifSource {
  /** Container duration in seconds, or `null` when it could not be read. */
  durationSeconds: number | null;
  /** Display size of the video track. */
  sourceWidth: number;
  sourceHeight: number;
  /** Whether the file carries an audio track (a GIF cannot keep it). */
  hasAudio: boolean;
  /** Yields the frames of the requested range, in presentation order. */
  frames(request: GifFrameRequest, ctx: GifRunContext): AsyncIterable<GifFrame>;
  /** Release the container. Always called, even when the run failed. */
  dispose(): void;
}

/** Opens a file for decoding. Injectable so tests can drive every branch. */
export type GifSourceOpener = (file: File, ctx: GifRunContext) => Promise<GifSource>;

export interface GifConversion {
  bytes: Uint8Array;
  filename: string;
  frameCount: number;
  width: number;
  height: number;
  fps: number;
  effectiveFps: number;
  delayMs: number;
  startSeconds: number;
  endSeconds: number;
  /** Length of the converted range in seconds. */
  rangeSeconds: number;
  colors: number;
  paletteScope: PaletteScope;
  dither: boolean;
  sourceWidth: number;
  sourceHeight: number;
  /** Whether the GIF is wider than the source clip (i.e. upscaled). */
  upscaled: boolean;
  hasAudio: boolean;
}

/** The whole conversion, injectable so the tool's plumbing can be tested. */
export type GifConverter = (
  file: File,
  options: OptionValues,
  ctx: GifRunContext,
) => Promise<GifConversion>;

/* -------------------------------------------------------------------------- */
/*  Decoding (Mediabunny)                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Open a clip with the shared video engine and expose its frames.
 *
 * The engine is loaded lazily (it is ~180 KB gzipped and must never end up in
 * the main bundle) and the frames are drawn into an `OffscreenCanvas`, which
 * keeps the whole pipeline inside the worker.
 *
 * The engine can be injected, which is how the tests exercise the error
 * paths (no video track, undecodable codec) without a real browser codec.
 */
export async function openMediabunnySource(
  file: File,
  ctx: GifRunContext,
  engine?: VideoEngine,
): Promise<GifSource> {
  const opened = engine
    ? await openVideoWith(engine, file, { signal: ctx.signal, onProgress: ctx.onProgress })
    : await openVideo(file, { signal: ctx.signal, onProgress: ctx.onProgress });
  const track = opened.videoTrack;
  if (!track) {
    opened.dispose();
    throw new ToolError(
      'This file has no video track.',
      'It looks like an audio-only file — the audio tools can inspect it instead.',
    );
  }

  try {
    if (!isWebCodecsAvailable()) {
      throw new ToolError(
        'This browser cannot decode video frames — WebCodecs is not available.',
        'Try a recent Chrome, Edge or Firefox; the Video File Info tool can still read the container.',
      );
    }
    const decodable = await track.canDecode();
    if (!decodable) {
      throw new ToolError(
        'This browser cannot decode the video codec used in this file.',
        'Re-export the clip as H.264 (MP4) or VP8/VP9 (WebM) and try again.',
      );
    }
    const sourceWidth = await track.getDisplayWidth();
    const sourceHeight = await track.getDisplayHeight();
    assertDecodeBudget(sourceWidth, sourceHeight);
    const resolved = engine ?? (await loadVideoEngine());

    return {
      durationSeconds: opened.durationSeconds,
      sourceWidth,
      sourceHeight,
      hasAudio: opened.audioTrack !== null,
      frames(request: GifFrameRequest, ctx2: GifRunContext): AsyncIterable<GifFrame> {
        return decodeFrames(resolved, track, request, ctx2);
      },
      dispose: () => opened.dispose(),
    };
  } catch (error) {
    opened.dispose();
    throw error;
  }
}

/** Decode the requested range and hand back scaled RGBA frames. */
async function* decodeFrames(
  engine: VideoEngine,
  track: InstanceType<VideoEngine['InputVideoTrack']>,
  request: GifFrameRequest,
  ctx: GifRunContext,
): AsyncIterable<GifFrame> {
  if (typeof OffscreenCanvas === 'undefined') {
    throw new ToolError(
      'This browser cannot draw video frames outside the page.',
      'Try a recent Chrome, Edge or Firefox.',
    );
  }
  const canvas = new OffscreenCanvas(request.width, request.height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new ToolError('This browser could not create a 2D drawing context.');
  }

  const sink = new engine.VideoSampleSink(track);
  for await (const sample of sink.samples(request.startSeconds, request.endSeconds)) {
    ctx.signal?.throwIfAborted?.();
    try {
      // A GIF has no alpha channel, so every frame is composited over black.
      // Without this, a transparent video would leave undefined pixels behind.
      context.fillStyle = '#000000';
      context.fillRect(0, 0, request.width, request.height);
      // `draw` honours the rotation and flip metadata of the track.
      sample.draw(context, 0, 0, request.width, request.height);
      const image = context.getImageData(0, 0, request.width, request.height);
      yield { timestamp: sample.timestamp, rgba: image.data };
    } finally {
      // Release the decoded frame even when the consumer stops early.
      sample.close();
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Conversion                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Convert a clip into a GIF.
 *
 * The source is injectable so the whole pipeline — sampling, palette building
 * and encoding — can be exercised in a unit test without a real codec.
 */
export async function convertVideoToGif(
  file: File,
  options: OptionValues,
  ctx: GifRunContext,
  open: GifSourceOpener = openMediabunnySource,
): Promise<GifConversion> {
  ctx.signal?.throwIfAborted?.();
  ctx.onProgress?.(0.02, 'Loading the video engine');
  const source = await open(file, ctx);
  try {
    ctx.onProgress?.(0.1, 'Planning the frames');
    const settings = resolveGifSettings(options, source);
    const targets = planFrameTimestamps(settings.startSeconds, settings.endSeconds, settings.fps);

    // Fail fast when the result is obviously going to be too big: encoding
    // 300 frames only to throw the output away would waste the user's time.
    const estimate = estimateGifBytes(
      settings.frameCount,
      settings.width,
      settings.height,
      settings.colors,
    );
    if (estimate > GIF_MAX_OUTPUT_BYTES * 1.25) {
      throw new ToolError(
        `That range would produce a GIF of roughly ${(estimate / 1024 / 1024).toFixed(0)} MB — over the ${GIF_MAX_OUTPUT_BYTES / 1024 / 1024} MB limit.`,
        'Shorten the range, lower the frame rate, use a smaller width or pick the "Small file" palette.',
      );
    }

    ctx.onProgress?.(0.12, 'Loading the GIF encoder');
    const api = await loadGifEncoder();
    const writer = createGifWriter(settings, api);

    const request: GifFrameRequest = {
      width: settings.width,
      height: settings.height,
      startSeconds: settings.startSeconds,
      endSeconds: settings.endSeconds,
    };

    let written = 0;
    const report = (): void => {
      const fraction = 0.15 + 0.8 * (written / targets.length);
      ctx.onProgress?.(fraction, `Encoding frame ${written} of ${targets.length}`);
    };

    // The decoded frames are sampled down to the requested frame rate: a
    // planned timestamp is covered by the last decoded frame at or before it.
    for await (const frame of selectFrames(source.frames(request, ctx), targets)) {
      ctx.signal?.throwIfAborted?.();
      writer.write(frame.rgba);
      written++;
      report();
    }

    if (!written) {
      throw new ToolError(
        'No frames could be decoded from the selected range.',
        'Try a wider time range, or pick a file this browser can decode.',
      );
    }

    ctx.onProgress?.(0.97, 'Finishing the GIF');
    const bytes = writer.finish();
    if (bytes.byteLength > GIF_MAX_OUTPUT_BYTES) {
      throw new ToolError(
        `The GIF came out at ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB — over the ${GIF_MAX_OUTPUT_BYTES / 1024 / 1024} MB limit.`,
        'Shorten the range, lower the frame rate or pick a smaller width.',
      );
    }
    ctx.onProgress?.(1, 'Done');

    return {
      bytes,
      filename: gifOutputFilename(file.name),
      frameCount: written,
      width: settings.width,
      height: settings.height,
      fps: settings.fps,
      effectiveFps: settings.effectiveFps,
      delayMs: settings.delayMs,
      startSeconds: settings.startSeconds,
      endSeconds: settings.endSeconds,
      rangeSeconds: settings.rangeSeconds,
      colors: settings.colors,
      paletteScope: settings.paletteScope,
      dither: settings.dither,
      sourceWidth: source.sourceWidth,
      sourceHeight: source.sourceHeight,
      upscaled: settings.width > source.sourceWidth,
      hasAudio: source.hasAudio,
    };
  } finally {
    source.dispose();
  }
}

/* -------------------------------------------------------------------------- */
/*  Tool                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Run the conversion and turn it into the workbench's result shape: the GIF
 * itself as a download, plus an inline animated preview so the user can check
 * the result before saving it.
 */
export async function runVideoToGif(
  input: FileRunInput,
  convert: GifConverter = convertVideoToGif,
): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const { files, signal, onProgress } = input;

  if (!files.length) throw new ToolError('Choose a video file.');
  if (files.length > 1) {
    throw new ToolError(`Choose one video file — ${files.length} were selected.`);
  }
  const file = files[0]!;

  const result = await convert(file, o, { signal, onProgress });

  const blob = new Blob([result.bytes.slice().buffer as ArrayBuffer], { type: 'image/gif' });
  const previewable = result.bytes.byteLength <= GIF_MAX_PREVIEW_BYTES;
  const previewUrl = previewable ? gifDataUrl(result.bytes) : undefined;
  // The thumbnail next to the download is a second copy of the same bytes, so
  // it is only offered for small GIFs.
  const thumbnailUrl =
    result.bytes.byteLength <= GIF_MAX_THUMBNAIL_BYTES ? previewUrl : undefined;

  const notes: string[] = [
    previewUrl
      ? 'The animation above is a preview — save the GIF to keep it.'
      : 'The GIF was too large to preview here — save it to view it.',
    `Range ${formatTimecode(result.startSeconds)} – ${formatTimecode(result.endSeconds)} · ${result.frameCount} frames · ${result.width} × ${result.height} · ${result.fps} fps`,
  ];
  if (result.hasAudio) {
    notes.push('The audio track was dropped — a GIF cannot carry sound.');
  }
  if (result.upscaled) {
    notes.push('The GIF is wider than the source clip, so the frames were scaled up.');
  }

  const warnings: string[] = [];
  if (Math.abs(result.effectiveFps - result.fps) > 0.05) {
    warnings.push(
      `GIF frame delays are stored in hundredths of a second, so ${result.fps} fps plays back at ${result.effectiveFps} fps.`,
    );
  }

  return {
    outputs: [{ filename: result.filename, blob, previewUrl: thumbnailUrl }],
    report: previewUrl ? { output: previewUrl, render: 'image' } : undefined,
    notes,
    warnings: warnings.length ? warnings : undefined,
    stats: {
      frames: result.frameCount,
      width: result.width,
      height: result.height,
      fps: result.fps,
      colors: result.colors,
      durationSeconds: Math.round(result.rangeSeconds * 100) / 100,
      sizeBytes: result.bytes.byteLength,
    },
  };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  return runVideoToGif(input);
}

const tool: FileToolModule = { meta, run };
export default tool;
