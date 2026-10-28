import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './video-frames.meta';
import { extractFrames } from './video-frames.core';
import { loadVideoEngine } from '@/lib/video';

async function run(input: FileRunInput): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const { files, signal, onProgress } = input;

  if (!files.length) {
    throw new ToolError('Choose a video file.');
  }
  if (files.length > 1) {
    throw new ToolError('Choose one video file at a time.');
  }

  const file = files[0]!;
  if (!file.size) {
    throw new ToolError('The video file is empty.');
  }

  onProgress?.(0.02, 'Loading video engine…');
  const engine = await loadVideoEngine();

  onProgress?.(0.1, 'Extracting frames…');
  const result = await extractFrames(
    file,
    {
      interval: o.interval,
      count: o.count,
      width: o.width,
      mode: o.mode,
    },
    { signal, onProgress },
    engine,
  );

  const outputs = result.frames.map((frame) => ({
    filename: frame.filename,
    blob: frame.blob,
  }));

  return {
    outputs,
    notes: [
      `Extracted ${result.frames.length} frame${result.frames.length > 1 ? 's' : ''} (${result.stats.mode} mode).`,
      `Source resolution: ${result.stats.sourceWidth} × ${result.stats.sourceHeight}.`,
      result.stats.totalDuration ? `Video duration: ${result.stats.totalDuration.toFixed(1)}s.` : '',
    ].filter(Boolean),
  stats: {
      framesExtracted: result.frames.length,
      sourceWidth: result.stats.sourceWidth,
      sourceHeight: result.stats.sourceHeight,
      totalDuration: result.stats.totalDuration ?? 0,
      mode: result.stats.mode,
      intervalSeconds: result.stats.intervalSeconds,
    },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;