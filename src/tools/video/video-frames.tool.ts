/**
 * Extract still frames from a video — as individual PNGs or as a contact sheet.
 *
 * The decode + draw + PNG-encode work happens in the tool worker so the page
 * never freezes, and nothing leaves the device: the clip is read from the local
 * `File` and decoded with the shared Mediabunny engine (`@/lib/video`).
 *
 * The pure decisions — which timestamps to sample, the contact-sheet grid, the
 * output names and the frame cap — live in `./video-frames.core` so they can be
 * unit tested without a browser codec.
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
  frameOutputFilename,
  FRAMES_MAX_PREVIEW_BYTES,
  resolveFramesSettings,
  samplingLabel,
  sheetCell,
  sheetOutputFilename,
  type FramesSettings,
} from './video-frames.core';
import { meta } from './video-frames.meta';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface FramesRunContext {
  signal?: AbortSignal;
  onProgress?: (fraction: number, message?: string) => void;
}

/** A decoded video, ready to be sampled at specific timestamps. */
export interface FramesSource {
  /** Container duration in seconds, or `null` when it could not be read. */
  durationSeconds: number | null;
  /** Display size of the video track. */
  sourceWidth: number;
  sourceHeight: number;
  /**
   * Yields one decoded sample per requested timestamp, in the same order.
   * `null` means no frame was available at that instant.
   */
  samples(timestamps: number[], ctx: FramesRunContext): AsyncIterable<unknown>;
  /** Release the container. Always called, even when the run failed. */
  dispose(): void;
}

/** Opens a file for decoding. Injectable so tests can drive every branch. */
export type FramesSourceOpener = (file: File, ctx: FramesRunContext) => Promise<FramesSource>;

/** One finished still, ready to ship. */
export interface FrameOutput {
  bytes: Uint8Array;
  filename: string;
  width: number;
  height: number;
  timestamp: number;
}

/** The whole extraction, injectable so the tool's plumbing can be tested. */
export interface FramesResult {
  settings: FramesSettings;
  /** Individual-mode frames. Empty in sheet mode. */
  frames: FrameOutput[];
  /** Sheet-mode bytes. Null in individual mode. */
  sheet: { bytes: Uint8Array; filename: string; width: number; height: number } | null;
  sourceWidth: number;
  sourceHeight: number;
}

export type FramesExtractor = (
  file: File,
  options: OptionValues,
  ctx: FramesRunContext,
) => Promise<FramesResult>;

/* -------------------------------------------------------------------------- */
/*  Decoding (Mediabunny)                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Open a clip with the shared video engine and expose its samples at exact
 * timestamps. The engine is loaded lazily and kept out of the main bundle.
 *
 * The engine can be injected, which is how the tests exercise the error paths
 * (no video track, undecodable codec) without a real browser codec.
 */
export async function openMediabunnySource(
  file: File,
  ctx: FramesRunContext,
  engine?: VideoEngine,
): Promise<FramesSource> {
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
      samples(timestamps: number[], ctx2: FramesRunContext): AsyncIterable<unknown> {
        const sink = new resolved.VideoSampleSink(track);
        return decodeAtTimestamps(sink, timestamps, ctx2);
      },
      dispose: () => opened.dispose(),
    };
  } catch (error) {
    opened.dispose();
    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/*  Decode-at-timestamps                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Decode the requested timestamps in one pass, honouring cancellation and
 * turning a decoder failure into a message a person can act on. A `null` sample
 * means no frame was available at that instant — the caller draws a solid cell.
 */
async function* decodeAtTimestamps(
  sink: InstanceType<VideoEngine['VideoSampleSink']>,
  timestamps: number[],
  ctx: FramesRunContext,
): AsyncGenerator<unknown, void, undefined> {
  try {
    for await (const sample of sink.samplesAtTimestamps(timestamps)) {
      ctx.signal?.throwIfAborted?.();
      yield sample;
    }
  } catch (error) {
    // A cancellation must stay a cancellation; the workbench shows it as such.
    if ((error as { name?: string })?.name === 'AbortError') throw error;
    if (error instanceof ToolError) throw error;
    throw new ToolError(
      'This video could not be decoded.',
      'The file may be damaged, or it may use a codec this browser cannot handle. Try another clip, or re-export it as H.264 (MP4).',
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  Canvas drawing                                                             */
/* -------------------------------------------------------------------------- */

/** The minimal 2D surface a decoded sample is drawn onto. */
export interface FrameCanvas {
  width: number;
  height: number;
  getContext(kind: '2d'): DrawingContext | null;
  convertToBlob(): Promise<Blob>;
}

export interface DrawingContext {
  fillStyle: string;
  fillRect(x: number, y: number, w: number, h: number): void;
  drawImage(...args: unknown[]): void;
}

/** A decoded sample with a `draw` method that honours rotation metadata. */
interface SampleLike {
  draw(ctx: DrawingContext, dx: number, dy: number, dw?: number, dh?: number): void;
}

/** Create an offscreen canvas, stubbable in tests via `globalThis.OffscreenCanvas`. */
export function createFrameCanvas(width: number, height: number): FrameCanvas {
  const Canvas = globalThis.OffscreenCanvas as
    (new (w: number, h: number) => FrameCanvas) | undefined;
  if (!Canvas) {
    throw new ToolError(
      'This browser cannot draw video frames outside the page.',
      'Try a recent Chrome, Edge or Firefox.',
    );
  }
  return new Canvas(width, height);
}

/* -------------------------------------------------------------------------- */
/*  Extraction                                                                 */
/* -------------------------------------------------------------------------- */

async function extractIndividual(
  source: FramesSource,
  settings: FramesSettings,
  ctx: FramesRunContext,
  sourceName: string,
): Promise<FramesResult> {
  const canvas = createFrameCanvas(settings.width, settings.height);
  const context = canvas.getContext('2d');
  if (!context) throw new ToolError('This browser could not create a 2D drawing context.');

  const frames: FrameOutput[] = [];
  let written = 0;
  let index = 0;
  for await (const raw of source.samples(settings.timestamps, ctx)) {
    ctx.signal?.throwIfAborted?.();
    const sample = raw as SampleLike | null;
    drawSample(context, sample, 0, 0, settings.width, settings.height);
    const blob = await canvas.convertToBlob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    frames.push({
      bytes,
      filename: frameOutputFilename(sourceName, index, settings.timestamps.length),
      width: settings.width,
      height: settings.height,
      timestamp: settings.timestamps[index] ?? 0,
    });
    index++;
    written++;
    ctx.onProgress?.(
      0.15 + 0.8 * (written / settings.timestamps.length),
      `Frame ${written} of ${settings.timestamps.length}`,
    );
  }

  if (!written) {
    throw new ToolError(
      'No frames could be decoded from the selected range.',
      'Try a wider range, or pick a file this browser can decode.',
    );
  }
  ctx.onProgress?.(1, 'Done');
  return {
    settings,
    frames,
    sheet: null,
    sourceWidth: source.sourceWidth,
    sourceHeight: source.sourceHeight,
  };
}

async function extractSheet(
  source: FramesSource,
  settings: FramesSettings,
  ctx: FramesRunContext,
  sourceName: string,
): Promise<FramesResult> {
  const grid = settings.sheet!;
  const canvas = createFrameCanvas(grid.canvasWidth, grid.canvasHeight);
  const context = canvas.getContext('2d');
  if (!context) throw new ToolError('This browser could not create a 2D drawing context.');

  // A contact sheet has no alpha channel; a transparent frame would leave
  // undefined pixels behind.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, grid.canvasWidth, grid.canvasHeight);

  let written = 0;
  let index = 0;
  for await (const raw of source.samples(settings.timestamps, ctx)) {
    ctx.signal?.throwIfAborted?.();
    const sample = raw as SampleLike | null;
    const cell = sheetCell(index, grid);
    drawSample(context, sample, cell.x, cell.y, cell.width, cell.height);
    if (sample) written++;
    index++;
    ctx.onProgress?.(
      0.15 + 0.8 * (index / settings.timestamps.length),
      `Frame ${Math.min(index, settings.timestamps.length)} of ${settings.timestamps.length}`,
    );
  }

  if (!written) {
    throw new ToolError(
      'No frames could be decoded from the selected range.',
      'Try a wider range, or pick a file this browser can decode.',
    );
  }
  ctx.onProgress?.(0.97, 'Encoding the contact sheet');
  const blob = await canvas.convertToBlob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  ctx.onProgress?.(1, 'Done');

  return {
    settings,
    frames: [],
    sheet: {
      bytes,
      filename: sheetOutputFilename(sourceName),
      width: grid.canvasWidth,
      height: grid.canvasHeight,
    },
    sourceWidth: source.sourceWidth,
    sourceHeight: source.sourceHeight,
  };
}

/** Composite one decoded sample over a solid cell, honouring rotation metadata. */
function drawSample(
  ctx: DrawingContext,
  sample: SampleLike | null,
  dx: number,
  dy: number,
  width: number,
  height: number,
): void {
  ctx.fillStyle = '#000000';
  ctx.fillRect(dx, dy, width, height);
  if (sample) sample.draw(ctx, dx, dy, width, height);
}

/**
 * Decode the requested frames and hand back the finished stills.
 * The source is injectable so the whole pipeline can be exercised in a unit
 * test without a real codec.
 */
export async function extractFrames(
  file: File,
  options: OptionValues,
  ctx: FramesRunContext,
  open: FramesSourceOpener = openMediabunnySource,
): Promise<FramesResult> {
  ctx.signal?.throwIfAborted?.();
  ctx.onProgress?.(0.02, 'Loading the video engine');
  const source = await open(file, ctx);
  try {
    ctx.onProgress?.(0.1, 'Planning the frames');
    const settings = resolveFramesSettings(options, {
      durationSeconds: source.durationSeconds,
      sourceWidth: source.sourceWidth,
      sourceHeight: source.sourceHeight,
    });

    return settings.layout === 'sheet'
      ? extractSheet(source, settings, ctx, file.name)
      : extractIndividual(source, settings, ctx, file.name);
  } finally {
    source.dispose();
  }
}

/* -------------------------------------------------------------------------- */
/*  Tool                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Run the extraction and turn it into the workbench's result shape: one output
 * per frame in individual mode, or a single contact-sheet image in sheet mode.
 */
export async function runVideoFrames(
  input: FileRunInput,
  extract: FramesExtractor,
): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const { files, signal, onProgress } = input;

  if (!files.length) throw new ToolError('Choose a video file.');
  if (files.length > 1) {
    throw new ToolError(`Choose one video file — ${files.length} were selected.`);
  }
  const file = files[0]!;

  const result = await extract(file, o, { signal, onProgress });
  const settings = result.settings;

  if (settings.layout === 'sheet' && result.sheet) {
    const sheet = result.sheet;
    const previewUrl = pngDataUrl(sheet.bytes);
    const blob = new Blob([sheet.bytes.slice().buffer as ArrayBuffer], { type: 'image/png' });
    return {
      outputs: [{ filename: sheet.filename, blob, previewUrl }],
      report: { output: previewUrl, render: 'image' },
      notes: [
        `${settings.timestamps.length} frames · ${settings.sheet?.columns} × ${settings.sheet?.rows} grid · ${settings.width} × ${settings.height} each`,
        `Range ${formatTimecode(settings.startSeconds)} – ${formatTimecode(settings.endSeconds)} · ${samplingLabel(settings.mode, settings.timestamps, readInterval(o))}`,
      ],
      stats: {
        frames: settings.timestamps.length,
        columns: settings.sheet?.columns ?? 0,
        rows: settings.sheet?.rows ?? 0,
        width: sheet.width,
        height: sheet.height,
        sizeBytes: sheet.bytes.byteLength,
      },
    };
  }

  const outputs = result.frames.map((frame) => ({
    filename: frame.filename,
    blob: new Blob([frame.bytes.slice().buffer as ArrayBuffer], { type: 'image/png' }),
    previewUrl:
      frame.bytes.byteLength <= FRAMES_MAX_PREVIEW_BYTES ? pngDataUrl(frame.bytes) : undefined,
  }));
  return {
    outputs,
    notes: [
      `${outputs.length} still${outputs.length === 1 ? '' : 's'} · ${settings.width} × ${settings.height}`,
      `Range ${formatTimecode(settings.startSeconds)} – ${formatTimecode(settings.endSeconds)} · ${samplingLabel(settings.mode, settings.timestamps, readInterval(o))}`,
    ],
    stats: {
      frames: outputs.length,
      width: settings.width,
      height: settings.height,
      durationSeconds: Math.round((settings.endSeconds - settings.startSeconds) * 100) / 100,
    },
  };
}

function readInterval(options: OptionValues): number {
  const n = Number(options.interval);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Base64-encode PNG bytes into a `data:image/png` URL for the inline preview. */
function pngDataUrl(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  return runVideoFrames(input, extractFrames);
}

const tool: FileToolModule = { meta, run };
export default tool;
