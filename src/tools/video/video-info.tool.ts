import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import {
  buildVideoProbeReport,
  formatTimecode,
  probeVideoFile,
  type VideoProbe,
  type VideoProbeOptions,
} from '@/lib/video';
import { meta } from './video-info.meta';

/** Injectable so tests can drive every branch without a real browser codec. */
export type VideoProbeFn = (file: File, options?: VideoProbeOptions) => Promise<VideoProbe>;

/**
 * Read a video file's container and track metadata. File tools run inside the
 * tool worker by default, where the shared engine lazily loads Mediabunny, so
 * the UI thread is never blocked while the container is parsed.
 */
export async function runVideoInfo(
  input: FileRunInput,
  probe: VideoProbeFn = probeVideoFile,
): Promise<FileRunResult> {
  const o = resolveOptions(meta, input.options);
  const { files, signal, onProgress } = input;

  if (!files.length) throw new ToolError('Choose a video file.');
  if (files.length > 1) {
    throw new ToolError(`Choose one video file — ${files.length} were selected.`);
  }

  const result = await probe(files[0]!, {
    signal,
    onProgress,
    scanFrames: o.scanFrames === true,
    readTags: o.readTags !== false,
    checkDecode: o.checkDecode !== false,
  });

  const report = buildVideoProbeReport(result);
  const warnings: string[] = [];
  if (result.durationSeconds == null) {
    warnings.push(
      'The duration could not be read from this file — it may be fragmented or truncated.',
    );
  }
  if (!result.webCodecs) {
    warnings.push(
      'This browser has no WebCodecs support, so frames cannot be decoded here — the metadata above is still read straight from the container.',
    );
  }
  if (result.webCodecs && result.videoTracks.some((t) => !t.decodable)) {
    warnings.push('At least one video track uses a codec this browser cannot decode.');
  }

  const primary = result.videoTracks[0];
  return {
    outputs: [],
    report: { output: JSON.stringify(report), render: 'table' },
    warnings: warnings.length ? warnings : undefined,
    notes: [
      result.durationSeconds == null
        ? 'Duration: unknown'
        : `Duration: ${formatTimecode(result.durationSeconds)}`,
    ],
    stats: {
      videoTracks: result.videoTracks.length,
      audioTracks: result.audioTracks.length,
      width: primary?.displayWidth ?? 0,
      height: primary?.displayHeight ?? 0,
      sizeBytes: result.fileSize,
    },
  };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  return runVideoInfo(input);
}

const tool: FileToolModule = { meta, run };
export default tool;
