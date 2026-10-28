/**
 * Video Frames — the pure, testable half.
 *
 * Uses the shared Mediabunny video engine to open a video file and extract
 * frames at specified timestamps using OffscreenCanvas for rendering.
 */
import { loadVideoEngine, openVideoWith, type VideoEngine, type OpenedVideo } from '@/lib/video';
import { ToolError } from '@/lib/types';

export interface FramePlan {
  timestamps: number[];
  intervalSeconds: number;
  width: number;
  mode: 'interval' | 'thumbnail';
}

export interface ExtractedFrame {
  index: number;
  timestamp: number;
  blob: Blob;
  filename: string;
}

export interface FrameExtractionResult {
  frames: ExtractedFrame[];
  stats: {
    sourceWidth: number;
    sourceHeight: number;
    frameCount: number;
    totalDuration: number | null;
    mode: 'interval' | 'thumbnail';
    intervalSeconds: number;
  };
}

export interface FrameExtractionContext {
  signal?: AbortSignal;
  onProgress?: (fraction: number, message?: string) => void;
}

export type ExtractFramesFn = (
  file: File,
  options: Record<string, string | number | boolean | undefined>,
  ctx: FrameExtractionContext,
  engine?: VideoEngine,
) => Promise<FrameExtractionResult>;

export function planFrameExtraction(
  durationSeconds: number | null,
  options: Record<string, string | number | boolean | undefined>,
  sourceWidth: number,
  sourceHeight: number,
): FramePlan {
  const intervalSeconds = Number(options.interval ?? 5);
  const count = Number(options.count ?? 10);
  const width = Number(options.width ?? 320);
  const mode = options.mode === 'thumbnail' ? 'thumbnail' : 'interval';
  if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0 || intervalSeconds > 30) {
    throw new ToolError('Frame interval must be between 0 and 30 seconds.');
  }
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    throw new ToolError('Frame count must be an integer between 1 and 50.');
  }
  if (!Number.isInteger(width) || width < 100 || width > 1280) {
    throw new ToolError('Thumbnail width must be an integer between 100 and 1280 pixels.');
  }
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth < 1 || sourceHeight < 1) {
    throw new ToolError('The video reports invalid frame dimensions.');
  }
  if (durationSeconds === null || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new ToolError('The video duration could not be read.');
  }
  const step = mode === 'thumbnail' ? durationSeconds / count : intervalSeconds;
  const timestamps: number[] = [];
  for (let time = 0; time < durationSeconds && timestamps.length < count; time += step) timestamps.push(time);
  if (timestamps.length === 0) throw new ToolError('No frames fall within this video.');
  return { timestamps, intervalSeconds, width, mode };
}

export function frameOutputName(sourceName: string, index: number, timestamp: number): string {
  const stem = sourceName.replace(/\.[^.]*$/, '') || 'video';
  return `${stem}-frame-${String(index + 1).padStart(3, '0')}-${Math.max(0, timestamp).toFixed(3).replace('.', '_')}s.png`;
}

export function frameDimensions(sourceWidth: number, sourceHeight: number, targetWidth: number) {
  const scale = Math.min(1, targetWidth / sourceWidth);
  return { width: Math.max(1, Math.round(sourceWidth * scale)), height: Math.max(1, Math.round(sourceHeight * scale)) };
}

/**
 * Extract a single frame at the given timestamp using the video engine's decoder.
 */
async function extractFrameAt(
  engine: VideoEngine,
  opened: OpenedVideo,
  timestamp: number,
  targetWidth: number,
  targetHeight: number,
): Promise<Blob> {
  const videoTrack = opened.videoTrack;
  if (!videoTrack) {
    throw new Error('No video track available');
  }

  // Check WebCodecs availability
  if (typeof OffscreenCanvas === 'undefined') {
    throw new Error('OffscreenCanvas is not available in this environment');
  }

  const canvas = new OffscreenCanvas(targetWidth, targetHeight);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Could not get 2d context from OffscreenCanvas');
  }

  // Use VideoSampleSink like video-to-gif does
  const sink = new engine.VideoSampleSink(videoTrack);
  let frame: { timestamp: number; blob: Blob } | null = null;

  try {
    // Seek to the timestamp by reading samples from the requested time
    for await (const sample of sink.samples(timestamp, timestamp + 1)) {
      // Draw the sample to canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      sample.draw(ctx, 0, 0, targetWidth, targetHeight);

      // Convert to PNG blob
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      frame = { timestamp: sample.timestamp, blob };
      sample.close();
      break;
    }
  } finally {
    // Ensure sink is cleaned up
  }

  if (!frame) {
    throw new Error(`Could not decode frame at ${timestamp}s`);
  }

  return frame.blob;
}

/**
 * Extract frames from a video at specified timestamps.
 */
export async function extractFrames(
  file: File,
  options: Record<string, string | number | boolean | undefined>,
  ctx: FrameExtractionContext = {},
  engine?: VideoEngine,
): Promise<FrameExtractionResult> {
  const { signal, onProgress } = ctx;
  if (signal?.aborted) throw new DOMException('The operation was cancelled.', 'AbortError');

  const engineToUse = engine ?? (await loadVideoEngine());

  // Check WebCodecs availability
  if (typeof globalThis.VideoDecoder !== 'function') {
    throw new ToolError(
      'Video frame extraction requires WebCodecs support.',
      'Your browser does not support the VideoDecoder API needed to extract frames. Try Chrome, Edge, or Firefox 113+.',
    );
  }

  onProgress?.(0.05, 'Opening file…');
  const opened = await openVideoWith(engineToUse, file, { signal });

  if (!opened.videoTrack) {
    throw new Error('No video track found in this file.');
  }

  const videoTrack = opened.videoTrack;
  const sourceWidth = await videoTrack.getCodedWidth();
  const sourceHeight = await videoTrack.getCodedHeight();
  const duration = opened.durationSeconds;

  // Plan the extraction
  const plan = planFrameExtraction(duration, options, sourceWidth, sourceHeight);
  const { timestamps, width, mode } = plan;
  const { width: targetWidth, height: targetHeight } = frameDimensions(sourceWidth, sourceHeight, width);

  onProgress?.(0.2, `Extracting ${timestamps.length} frame${timestamps.length > 1 ? 's' : ''}…`);

  const frames: ExtractedFrame[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    if (signal?.aborted) throw new DOMException('The operation was cancelled.', 'AbortError');

    const timestamp = timestamps[i]!;
    onProgress?.(0.2 + 0.7 * (i / timestamps.length), `Extracting frame ${i + 1}/${timestamps.length} at ${timestamp.toFixed(2)}s`);

    try {
      const blob = await extractFrameAt(engineToUse, opened, timestamp, targetWidth, targetHeight);
      const filename = frameOutputName(file.name, i, timestamp);
      frames.push({ index: i, timestamp, blob, filename });
    } catch (err) {
      console.warn(`Failed to extract frame at ${timestamp}s:`, err);
      // Continue with other frames
    }
  }

  onProgress?.(0.95, 'Finalizing…');

  await opened.dispose();

  if (frames.length === 0) {
    throw new Error('No frames could be extracted from the video.');
  }

  const stats = {
    sourceWidth,
    sourceHeight,
    frameCount: frames.length,
    totalDuration: duration,
    mode,
    intervalSeconds: plan.intervalSeconds,
  } satisfies FrameExtractionResult['stats'];

  onProgress?.(1, 'Done');

  return { frames, stats };
}